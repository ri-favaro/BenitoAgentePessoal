import { tool } from "ai";
import { z } from "zod";
import { TerminalRunner } from "../orchestration/terminal-runner.js";
import { CodingOrchestrator } from "../orchestration/coding-orchestrator.js";
import { GitHubService } from "../core/github-service.js";
import { VectorStore } from "../core/vector-store.js";
import { EmbeddingService } from "../core/embedding-service.js";

export interface OrchestrationToolsOptions {
  terminalRunner?: TerminalRunner;
  codingOrchestrator?: CodingOrchestrator;
  gitHubService?: GitHubService;
  vectorStore?: VectorStore;
  embeddingService?: EmbeddingService;
}

export function createOrchestrationTools(options?: OrchestrationToolsOptions) {
  const runner = options?.terminalRunner || new TerminalRunner();
  const orchestrator =
    options?.codingOrchestrator ||
    new CodingOrchestrator({
      terminalRunner: runner,
      gitHubService: options?.gitHubService,
      vectorStore: options?.vectorStore,
      embeddingService: options?.embeddingService,
    });

  return {
    execute_workspace_command: tool({
      description:
        "Executa comandos controlados no terminal dentro dos diretórios autorizados do projeto (ALLOWED_DIRECTORIES). Permite executar ferramentas essenciais de desenvolvimento como 'git', 'npm', 'npx', 'node' ou 'agy' com medição de tempo e limites de segurança.",
      parameters: z.object({
        command: z
          .string()
          .describe(
            "Comando base a ser executado. Deve pertencer à whitelist permitida ('agy', 'npm', 'npx', 'git', 'node')."
          ),
        args: z
          .array(z.string())
          .optional()
          .default([])
          .describe(
            "Lista de argumentos para o comando (ex: ['status'], ['run', 'build'], ['test'])."
          ),
        cwd: z
          .string()
          .optional()
          .describe(
            "Diretório de trabalho onde o comando será executado. Deve estar dentro dos diretórios autorizados. Se omitido, usa o diretório do projeto."
          ),
        timeoutMs: z
          .number()
          .optional()
          .describe(
            "Tempo limite em milissegundos para a execução do comando (padrão: 300000 = 5 minutos)."
          ),
      }),
      execute: async ({ command, args = [], cwd, timeoutMs }) => {
        try {
          const result = await runner.execute({
            command,
            args,
            cwd,
            timeoutMs,
          });

          if (!result.success) {
            return {
              success: false,
              command: result.command,
              args: result.args,
              cwd: result.cwd,
              exitCode: result.exitCode,
              error: result.error || "O comando falhou durante a execução.",
              stdout: result.stdout,
              stderr: result.stderr,
              durationMs: result.durationMs,
            };
          }

          return {
            success: true,
            command: result.command,
            args: result.args,
            cwd: result.cwd,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs,
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Erro ao executar workspace command: ${err?.message || String(err)}`,
          };
        }
      },
    }),

    prepare_coding_task: tool({
      description:
        "Prepara e empacota o contexto técnico estruturado de uma issue do GitHub (título, descrição, critérios de aceite, snippets de código do LanceDB e diretrizes de engenharia) para visualização ou posterior delegação ao agente de coding (AGY CLI).",
      parameters: z.object({
        issueNumber: z
          .number()
          .describe("Número da issue no GitHub a ser preparada (ex: 15, 21)."),
        additionalInstructions: z
          .string()
          .optional()
          .describe(
            "Instruções técnicas complementares do Tech Lead (Benito) para orientar a implementação."
          ),
        searchQueries: z
          .array(z.string())
          .optional()
          .describe(
            "Termos opcionais para busca semântica no LanceDB para extrair snippets de código relevantes."
          ),
        repo: z
          .string()
          .optional()
          .describe("Repositório opcional no formato 'owner/repo'."),
        branchName: z
          .string()
          .optional()
          .describe("Nome customizado para a branch da tarefa."),
      }),
      execute: async ({
        issueNumber,
        additionalInstructions,
        searchQueries,
        repo,
        branchName,
      }) => {
        try {
          const result = await orchestrator.prepareTask({
            issueNumber,
            additionalInstructions,
            searchQueries,
            repo,
            branchName,
          });

          if (!result.success || !result.packedTask) {
            return {
              success: false,
              error: result.error || `Não foi possível preparar a tarefa para a issue #${issueNumber}.`,
            };
          }

          const { packedTask } = result;

          return {
            success: true,
            issueNumber: packedTask.issueNumber,
            issueTitle: packedTask.issueTitle,
            branchName: packedTask.branchName,
            contextSnippetsCount: packedTask.contextSnippetsCount,
            estimatedPromptLength: packedTask.estimatedPromptLength,
            promptPreview: packedTask.prompt.slice(0, 1000) + (packedTask.prompt.length > 1000 ? "\n\n[...conteúdo truncado para visualização...]" : ""),
            fullPrompt: packedTask.prompt,
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Erro ao executar prepare_coding_task: ${err?.message || String(err)}`,
          };
        }
      },
    }),

    delegate_issue_to_coding_agent: tool({
      description:
        "Delega a implementação de uma issue do GitHub para a LLM especializada de programação (AGY CLI) em processo isolado. ESCOPO ESTRITO: Destinado EXCLUSIVAMENTE à implementação de issues técnicas abertas no repositório do Benito (este projeto). NUNCA utilize para solicitações pontuais de geração de código, exemplos ou scripts para o usuário; essas devem ser atendidas diretamente no chat ou em scratch/. ATENÇÃO OBRIGATÓRIA (HUMAN-IN-THE-LOOP): NUNCA execute em modo real sem antes propor a minuta no chat (título, escopo e branch) e obter autorização explícita do usuário. Use dryRun: true para simulação segura sem alterar arquivos.",
      parameters: z.object({
        issueNumber: z
          .number()
          .describe("Número da issue no GitHub a ser implementada."),
        confirmedByUser: z
          .boolean()
          .describe(
            "Trava de segurança Human-in-the-Loop: deve ser true indicando que o usuário aprovou explicitamente a execução do coding agent no repositório."
          ),
        additionalInstructions: z
          .string()
          .optional()
          .describe("Instruções técnicas complementares para o coding agent."),
        searchQueries: z
          .array(z.string())
          .optional()
          .describe("Termos opcionais para busca vetorial de contexto de código."),
        branchName: z
          .string()
          .optional()
          .describe("Nome da branch de trabalho."),
        dryRun: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Se true, simula a preparação e chamada sem disparar alterações em disco."
          ),
        repo: z
          .string()
          .optional()
          .describe("Repositório opcional 'owner/repo'."),
        timeoutMs: z
          .number()
          .optional()
          .describe("Tempo limite em milissegundos para o AGY CLI (padrão: 300000)."),
        autoCreatePr: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Se true, após o AGY finalizar e a compilação local passar, envia a branch ao GitHub e abre a Pull Request automaticamente."
          ),
      }),
      execute: async ({
        issueNumber,
        confirmedByUser,
        additionalInstructions,
        searchQueries,
        branchName,
        dryRun = false,
        repo,
        timeoutMs,
        autoCreatePr = false,
      }) => {
        try {
          // Trava de segurança Human-in-the-Loop
          if (!confirmedByUser && !dryRun) {
            return {
              success: false,
              error:
                "Operação bloqueada pela trava Human-in-the-Loop: Você deve apresentar o plano e obter a autorização explícita do Luiz Ricardo antes de disparar o AGY CLI. Para simulação sem risco, use dryRun: true.",
            };
          }

          const result = await orchestrator.delegateIssue({
            issueNumber,
            additionalInstructions,
            searchQueries,
            branchName,
            dryRun,
            repo,
            timeoutMs,
            autoCreatePr,
          });

          if (!result.success) {
            return {
              success: false,
              error: result.error || "Falha na delegação da issue.",
              terminalOutput: result.terminalResult?.stderr || result.terminalResult?.stdout,
            };
          }

          return {
            success: true,
            issueNumber,
            branchName: result.packedTask.branchName,
            dryRun,
            durationMs: result.terminalResult?.durationMs,
            terminalStdout: result.terminalResult?.stdout,
            validation: result.validation,
            pullRequest: result.pullRequest,
            message: dryRun
              ? `[DRY-RUN] Simulação concluída com sucesso para a Issue #${issueNumber}. O prompt estruturado está pronto para ser executado quando autorizado.`
              : `Implementação da Issue #${issueNumber} executada pelo AGY CLI. Validação técnica: ${
                  result.validation?.buildSuccess ? "Build OK" : "Falha de build"
                }.${result.pullRequest?.url ? ` Pull Request aberto: ${result.pullRequest.url}` : ""}`,
          };
        } catch (err: any) {
          return {
            success: false,
            error: `Erro ao executar delegate_issue_to_coding_agent: ${err?.message || String(err)}`,
          };
        }
      },
    }),
  };
}
