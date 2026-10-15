import path from "node:path";
import { GitHubService, type GitHubIssueDetail } from "../core/github-service.js";
import { TerminalRunner, type TerminalExecutionResult } from "./terminal-runner.js";
import { TaskPacker, type CodeContextSnippet, type PackedTask } from "./task-packer.js";
import { VectorStore } from "../core/vector-store.js";
import { EmbeddingService } from "../core/embedding-service.js";

export interface PrepareTaskOptions {
  issueNumber: number;
  repo?: string;
  additionalInstructions?: string;
  searchQueries?: string[];
  branchName?: string;
}

export interface DelegateExecutionOptions {
  packedTask: PackedTask;
  dryRun?: boolean;
  cwd?: string;
  timeoutMs?: number;
}

export interface ValidationSummary {
  buildSuccess: boolean;
  modifiedFiles: string[];
  diffStat: string;
  details: string;
}

export interface FullOrchestrationResult {
  success: boolean;
  packedTask: PackedTask;
  terminalResult?: TerminalExecutionResult;
  validation?: ValidationSummary;
  pullRequest?: {
    url?: string;
    prNumber?: number;
    error?: string;
  };
  error?: string;
}

/**
 * CodingOrchestrator coordena a preparação de contexto, execução do AGY CLI
 * e validação técnica local das alterações realizadas.
 */
export class CodingOrchestrator {
  private gitHubService: GitHubService;
  private terminalRunner: TerminalRunner;
  private taskPacker: TaskPacker;
  private vectorStore?: VectorStore;
  private embeddingService?: EmbeddingService;
  private projectRoot: string;

  constructor(options?: {
    gitHubService?: GitHubService;
    terminalRunner?: TerminalRunner;
    taskPacker?: TaskPacker;
    vectorStore?: VectorStore;
    embeddingService?: EmbeddingService;
    projectRoot?: string;
  }) {
    this.projectRoot = options?.projectRoot || process.cwd();
    this.gitHubService = options?.gitHubService || new GitHubService(this.projectRoot);
    this.terminalRunner =
      options?.terminalRunner || new TerminalRunner({ projectRoot: this.projectRoot });
    this.taskPacker = options?.taskPacker || new TaskPacker();
    this.vectorStore = options?.vectorStore;
    this.embeddingService = options?.embeddingService;
  }

  /**
   * Prepara o contexto completo de uma issue consultando metadados no GitHub
   * e trechos relevantes de código via RAG (se disponível).
   */
  async prepareTask(
    options: PrepareTaskOptions
  ): Promise<{ success: boolean; packedTask?: PackedTask; error?: string }> {
    try {
      // 1. Busca metadados da issue
      const issueResult = await this.gitHubService.getIssue(
        options.issueNumber,
        options.repo
      );

      if (!issueResult.success || !issueResult.issue) {
        return {
          success: false,
          error:
            issueResult.error ||
            `Não foi possível localizar a Issue #${options.issueNumber}.`,
        };
      }

      const issue = issueResult.issue;
      const codeSnippets: CodeContextSnippet[] = [];

      // 2. Busca semântica no LanceDB se o serviço estiver disponível
      if (this.vectorStore && this.embeddingService) {
        const queries = options.searchQueries && options.searchQueries.length > 0
          ? options.searchQueries
          : [issue.title];

        for (const q of queries.slice(0, 2)) {
          try {
            const queryVec = await this.embeddingService.getEmbedding(q);
            const searchResults = await this.vectorStore.searchCodebase(queryVec, {
              limit: 3,
            });

            for (const res of searchResults) {
              if (!codeSnippets.some((s) => s.path === res.relativePath)) {
                codeSnippets.push({
                  path: res.relativePath,
                  content: res.content.slice(0, 1500),
                  score: res.similarity,
                });
              }
            }
          } catch {
            // Se o embedding service estiver offline, prossegue sem travar a orquestração
          }
        }
      }

      // 3. Empacota o prompt estruturado
      const packedTask = this.taskPacker.packTask({
        issue,
        codeSnippets,
        additionalInstructions: options.additionalInstructions,
        branchName: options.branchName,
      });

      return {
        success: true,
        packedTask,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Erro ao preparar tarefa: ${err?.message || String(err)}`,
      };
    }
  }

  /**
   * Dispara a execução do AGY CLI em processo isolado ou executa dry-run.
   */
  async executeAgy(
    options: DelegateExecutionOptions
  ): Promise<TerminalExecutionResult> {
    const cwd = options.cwd ? path.resolve(options.cwd) : this.projectRoot;

    if (options.dryRun) {
      return {
        success: true,
        command: "agy",
        args: ["--prompt", `<Prompt estruturado com ${options.packedTask.estimatedPromptLength} caracteres>`, "--dangerously-skip-permissions"],
        cwd,
        exitCode: 0,
        stdout: "[DRY-RUN] Execução simulada com sucesso do AGY CLI. Nenhuma alteração realizada em disco.",
        stderr: "",
        durationMs: 5,
      };
    }

    return this.terminalRunner.execute({
      command: "agy",
      args: ["--prompt", options.packedTask.prompt, "--dangerously-skip-permissions"],
      cwd,
      timeoutMs: options.timeoutMs,
    });
  }

  /**
   * Inspeciona arquivos modificados, diff e executa npm run build para validar o resultado.
   */
  async validateResults(cwd?: string): Promise<ValidationSummary> {
    const targetCwd = cwd ? path.resolve(cwd) : this.projectRoot;

    // 1. Inspeciona arquivos alterados via git status
    const statusRes = await this.terminalRunner.execute({
      command: "git",
      args: ["status", "--porcelain"],
      cwd: targetCwd,
    });

    const modifiedFiles = statusRes.stdout
      ? statusRes.stdout
          .split("\n")
          .map((l) => l.trim().slice(3).trim())
          .filter(Boolean)
      : [];

    // 2. Coleta sumário estatístico do diff
    const diffRes = await this.terminalRunner.execute({
      command: "git",
      args: ["diff", "--stat"],
      cwd: targetCwd,
    });

    const diffStat = diffRes.stdout || "Nenhum diff encontrado no repositório.";

    // 3. Executa compilação do TypeScript para validação
    const buildRes = await this.terminalRunner.execute({
      command: "npm",
      args: ["run", "build"],
      cwd: targetCwd,
    });

    const buildSuccess = buildRes.success && buildRes.exitCode === 0;

    const details = [
      `Arquivos alterados (${modifiedFiles.length}): ${
        modifiedFiles.join(", ") || "Nenhum"
      }`,
      `Status do Build: ${buildSuccess ? "Sucesso (npm run build OK)" : "Falha na compilação"}`,
      diffStat ? `Diff Stat:\n${diffStat}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      buildSuccess,
      modifiedFiles,
      diffStat,
      details,
    };
  }

  /**
   * Ciclo completo de delegação de uma issue para o agente de coding.
   */
  async delegateIssue(options: {
    issueNumber: number;
    repo?: string;
    additionalInstructions?: string;
    searchQueries?: string[];
    branchName?: string;
    dryRun?: boolean;
    cwd?: string;
    timeoutMs?: number;
    autoCreatePr?: boolean;
  }): Promise<FullOrchestrationResult> {
    // 1. Preparação
    const prep = await this.prepareTask({
      issueNumber: options.issueNumber,
      repo: options.repo,
      additionalInstructions: options.additionalInstructions,
      searchQueries: options.searchQueries,
      branchName: options.branchName,
    });

    if (!prep.success || !prep.packedTask) {
      return {
        success: false,
        packedTask: {
          issueNumber: options.issueNumber,
          issueTitle: "",
          issueUrl: "",
          branchName: "",
          prompt: "",
          contextSnippetsCount: 0,
          estimatedPromptLength: 0,
        },
        error: prep.error || "Falha na preparação da tarefa.",
      };
    }

    // 2. Execução
    const termRes = await this.executeAgy({
      packedTask: prep.packedTask,
      dryRun: options.dryRun,
      cwd: options.cwd,
      timeoutMs: options.timeoutMs,
    });

    if (!termRes.success) {
      return {
        success: false,
        packedTask: prep.packedTask,
        terminalResult: termRes,
        error: termRes.error || "Execução do AGY CLI retornou erro.",
      };
    }

    // 3. Validação pós-execução (se não for dry-run)
    let validation: ValidationSummary | undefined;
    if (!options.dryRun) {
      validation = await this.validateResults(options.cwd);
    }

    // 4. Abertura opcional de Pull Request se solicitado
    let pullRequest: { url?: string; prNumber?: number; error?: string } | undefined;
    if (options.autoCreatePr) {
      if (options.dryRun) {
        pullRequest = {
          url: `[DRY-RUN] Simulação de Pull Request para branch ${prep.packedTask.branchName}`,
          prNumber: 999,
        };
      } else if (validation?.buildSuccess) {
        const prRes = await this.gitHubService.createPullRequest({
          title: prep.packedTask.issueTitle,
          body: `Implementa a Issue #${prep.packedTask.issueNumber} via AGY CLI.\n\n### Resumo da Validação Técnica\n${validation.details}`,
          headBranch: prep.packedTask.branchName,
          repo: options.repo,
        });

        if (prRes.success) {
          pullRequest = {
            url: prRes.url,
            prNumber: prRes.prNumber,
          };
        } else {
          pullRequest = {
            error: prRes.error || "Falha ao criar Pull Request.",
          };
        }
      }
    }

    return {
      success: true,
      packedTask: prep.packedTask,
      terminalResult: termRes,
      validation,
      pullRequest,
    };
  }
}
