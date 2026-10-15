import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
  labels: string[];
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateIssueOptions {
  title: string;
  body: string;
  labels?: string[];
  repo?: string;
}

export interface ListIssuesOptions {
  state?: "open" | "closed" | "all";
  limit?: number;
  labels?: string[];
  repo?: string;
}

export interface IssueExecutionResult {
  success: boolean;
  url?: string;
  issueNumber?: number;
  error?: string;
}

export interface ListIssuesResult {
  success: boolean;
  issues?: GitHubIssueItem[];
  totalFound?: number;
  error?: string;
}

export interface GitHubIssueDetail {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetIssueResult {
  success: boolean;
  issue?: GitHubIssueDetail;
  error?: string;
}

export interface CreatePullRequestOptions {
  title: string;
  body: string;
  headBranch?: string;
  baseBranch?: string;
  labels?: string[];
  draft?: boolean;
  repo?: string;
}

export interface PullRequestExecutionResult {
  success: boolean;
  url?: string;
  prNumber?: number;
  error?: string;
}

export interface GitHubPullRequestFile {
  path: string;
  additions: number;
  deletions: number;
  changeType?: string;
}

export interface GitHubPullRequestCommit {
  oid: string;
  messageHeadline: string;
  messageBody?: string;
  authoredDate?: string;
  authors?: Array<{ name?: string; email?: string; login?: string }>;
}

export interface GitHubPullRequestReview {
  author?: { login?: string; name?: string };
  state?: string;
  submittedAt?: string;
  body?: string;
}

export interface GitHubPullRequestItem {
  number: number;
  title: string;
  body: string;
  state: string;
  mergedAt?: string;
  closedAt?: string;
  createdAt?: string;
  url: string;
  author: string;
  headRefName?: string;
  baseRefName?: string;
  changedFiles?: number;
  additions?: number;
  deletions?: number;
  files?: GitHubPullRequestFile[];
  commits?: GitHubPullRequestCommit[];
  reviews?: GitHubPullRequestReview[];
}

export type RiskLevel = "BAIXO" | "MÉDIO" | "ALTO" | "CRÍTICO";

export interface ArchitecturalImpact {
  hasSqlMigrations: boolean;
  sqlFiles: string[];
  sqlDestructive?: boolean;
  hasDependencyChanges: boolean;
  dependencyFiles: string[];
  dependencyDetails?: string[];
  hasEnvChanges: boolean;
  envFiles: string[];
  hasBreakingChanges: boolean;
  breakingChangeReasons: string[];
  hasTestsIncluded: boolean;
  testFiles: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
}

export interface SummarizePullRequestOptions {
  repo?: string;
  includeDiff?: boolean;
}

export interface SummarizePullRequestResult {
  success: boolean;
  prNumber?: number;
  title?: string;
  url?: string;
  state?: string;
  author?: string;
  headBranch?: string;
  baseBranch?: string;
  stats?: {
    additions: number;
    deletions: number;
    changedFiles: number;
  };
  architecturalImpact?: ArchitecturalImpact;
  summary?: string;
  diffSummary?: string;
  error?: string;
}

export interface ListPullRequestsOptions {
  state?: "open" | "closed" | "merged" | "all";
  limit?: number;
  since?: string;
  sinceHours?: number;
  sinceDays?: number;
  base?: string;
  repo?: string;
}

export interface ListPullRequestsResult {
  success: boolean;
  pullRequests?: GitHubPullRequestItem[];
  totalFound?: number;
  error?: string;
}

export interface GetPullRequestResult {
  success: boolean;
  pullRequest?: GitHubPullRequestItem;
  diff?: string;
  error?: string;
}

export interface GitHubCommitItem {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail?: string;
  date: string;
  message: string;
}

export interface ListCommitsOptions {
  limit?: number;
  since?: string;
  sinceHours?: number;
  sinceDays?: number;
  author?: string;
  path?: string;
  repo?: string;
}

export interface ListCommitsResult {
  success: boolean;
  commits?: GitHubCommitItem[];
  totalFound?: number;
  error?: string;
}

export interface SummarizeMergedOptions extends ListPullRequestsOptions {
  includeFileList?: boolean;
}

export interface SummarizeMergedResult {
  success: boolean;
  totalMerged: number;
  summary: string;
  pullRequests?: GitHubPullRequestItem[];
  error?: string;
}

/**
 * Converte expressao de tempo (horas, dias, 'today', 'yesterday', '24h', '7d', ISO date) em Date.
 */
export function parseSinceDate(
  since?: string,
  sinceHours?: number,
  sinceDays?: number
): Date | null {
  if (typeof sinceHours === "number" && !isNaN(sinceHours) && sinceHours > 0) {
    return new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  }
  if (typeof sinceDays === "number" && !isNaN(sinceDays) && sinceDays > 0) {
    return new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  }
  if (!since) return null;

  const trimmed = since.trim().toLowerCase();
  if (trimmed === "today" || trimmed === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (trimmed === "yesterday" || trimmed === "ontem") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const hoursMatch = trimmed.match(/^(\d+)\s*h(?:our|ora|s)?$/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  const daysMatch = trimmed.match(/^(\d+)\s*d(?:ay|ia|s)?$/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  const parsed = Date.parse(since);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

export class GitHubService {
  private projectRoot: string;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || process.cwd();
  }

  /**
   * Prepara os metadados da issue aplicando o rodapé padrão e a label de identificação autônoma.
   */
  prepareIssuePayload(options: CreateIssueOptions): {
    title: string;
    body: string;
    labels: string[];
    repo?: string;
  } {
    const rawLabels = options.labels || [];
    const labelsSet = new Set(rawLabels.map((l) => l.trim()).filter(Boolean));
    // Garante sempre a label de auto-melhoria autônoma do Benito
    labelsSet.add("benito-sugestao");

    const defaultFooter = "\n\n---\n> *Issue criada e registrada por Benito.*";

    const bodyWithFooter =
      options.body.includes("Issue criada e registrada por Benito") ||
      options.body.includes("Issue gerada e registrada pelo Benito")
        ? options.body
        : `${options.body.trim()}${defaultFooter}`;

    return {
      title: options.title.trim(),
      body: bodyWithFooter,
      labels: Array.from(labelsSet),
      repo: options.repo?.trim() || undefined,
    };
  }

  /**
   * Prepara os metadados do pull request aplicando o rodapé de marca d'água e a label padrão.
   */
  preparePullRequestPayload(options: CreatePullRequestOptions): {
    title: string;
    body: string;
    headBranch?: string;
    baseBranch: string;
    labels: string[];
    draft: boolean;
    repo?: string;
  } {
    const rawLabels = options.labels || [];
    const labelsSet = new Set(rawLabels.map((l) => l.trim()).filter(Boolean));
    // Label para identificar PRs criadas pelo Benito
    labelsSet.add("benito-pr");

    const defaultFooter = "\n\n---\n> *Pull Request criado por Benito.*";

    const bodyWithFooter = options.body.includes("Pull Request criado por Benito")
      ? options.body
      : `${options.body.trim()}${defaultFooter}`;

    return {
      title: options.title.trim(),
      body: bodyWithFooter,
      headBranch: options.headBranch?.trim() || undefined,
      baseBranch: options.baseBranch?.trim() || "main",
      labels: Array.from(labelsSet),
      draft: options.draft ?? false,
      repo: options.repo?.trim() || undefined,
    };
  }

  /**
   * Executa a criação da issue no GitHub via CLI `gh issue create`.
   */
  async createIssue(options: CreateIssueOptions): Promise<IssueExecutionResult> {
    try {
      const payload = this.prepareIssuePayload(options);
      const args = ["issue", "create", "--title", payload.title, "--body", payload.body];

      for (const label of payload.labels) {
        args.push("--label", label);
      }

      if (payload.repo) {
        args.push("--repo", payload.repo);
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const url = stdout.trim();
      // Tenta extrair o número da issue a partir da URL gerada
      const matchNumber = url.match(/\/issues\/(\d+)$/);
      const issueNumber = matchNumber ? parseInt(matchNumber[1], 10) : undefined;

      return {
        success: true,
        url,
        issueNumber,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh issue create': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Executa a criação do Pull Request no GitHub via CLI `gh pr create`.
   * Garante push da branch de origem para o origin se headBranch for fornecida.
   */
  async createPullRequest(options: CreatePullRequestOptions): Promise<PullRequestExecutionResult> {
    try {
      const payload = this.preparePullRequestPayload(options);

      // Se headBranch foi fornecida, tenta sincronizar a branch no remoto
      if (payload.headBranch) {
        try {
          await execFileAsync("git", ["push", "-u", "origin", payload.headBranch], {
            cwd: this.projectRoot,
            windowsHide: true,
          });
        } catch {
          // Se o push falhar (ex: branch já atualizada ou offline), deixa o gh CLI relatar caso falte no remoto
        }
      }

      const args = [
        "pr",
        "create",
        "--title",
        payload.title,
        "--body",
        payload.body,
        "--base",
        payload.baseBranch,
      ];

      if (payload.headBranch) {
        args.push("--head", payload.headBranch);
      }

      for (const label of payload.labels) {
        args.push("--label", label);
      }

      if (payload.draft) {
        args.push("--draft");
      }

      if (payload.repo) {
        args.push("--repo", payload.repo);
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const url = stdout.trim();
      const matchNumber = url.match(/\/pull\/(\d+)$/);
      const prNumber = matchNumber ? parseInt(matchNumber[1], 10) : undefined;

      return {
        success: true,
        url,
        prNumber,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh pr create': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Lista issues do repositório via CLI `gh issue list --json ...`.
   */
  async listIssues(options: ListIssuesOptions = {}): Promise<ListIssuesResult> {
    try {
      const state = options.state || "open";
      const limit = Math.min(Math.max(options.limit || 10, 1), 50);

      const args = [
        "issue",
        "list",
        "--state",
        state,
        "--limit",
        String(limit),
        "--json",
        "number,title,state,labels,url,createdAt,updatedAt",
      ];

      if (options.labels && options.labels.length > 0) {
        for (const label of options.labels) {
          args.push("--label", label.trim());
        }
      }

      if (options.repo && options.repo.trim()) {
        args.push("--repo", options.repo.trim());
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const rawJson = stdout.trim();
      if (!rawJson) {
        return {
          success: true,
          issues: [],
          totalFound: 0,
        };
      }

      const parsed: any[] = JSON.parse(rawJson);
      const issues: GitHubIssueItem[] = parsed.map((item) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        labels: Array.isArray(item.labels)
          ? item.labels.map((l: any) => (typeof l === "string" ? l : l.name || ""))
          : [],
        url: item.url,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return {
        success: true,
        issues,
        totalFound: issues.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh issue list': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Obtém os detalhes completos de uma issue específica via CLI `gh issue view <number> --json ...`.
   */
  async getIssue(issueNumber: number, repo?: string): Promise<GetIssueResult> {
    try {
      const args = [
        "issue",
        "view",
        String(issueNumber),
        "--json",
        "number,title,body,state,labels,url,createdAt,updatedAt",
      ];

      if (repo && repo.trim()) {
        args.push("--repo", repo.trim());
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const rawJson = stdout.trim();
      if (!rawJson) {
        return {
          success: false,
          error: `Issue #${issueNumber} não encontrada ou vazia.`,
        };
      }

      const parsed = JSON.parse(rawJson);
      const issue: GitHubIssueDetail = {
        number: parsed.number,
        title: parsed.title,
        body: parsed.body || "",
        state: parsed.state,
        labels: Array.isArray(parsed.labels)
          ? parsed.labels.map((l: any) => (typeof l === "string" ? l : l.name || ""))
          : [],
        url: parsed.url,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
      };

      return {
        success: true,
        issue,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh issue view #${issueNumber}': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Lista Pull Requests do repositório via CLI `gh pr list --json ...`.
   * Suporta filtros por estado ('merged', 'open', 'closed', 'all') e período temporal.
   */
  async listPullRequests(options: ListPullRequestsOptions = {}): Promise<ListPullRequestsResult> {
    try {
      const state = options.state || "merged";
      const limit = Math.min(Math.max(options.limit || 10, 1), 50);

      const args = [
        "pr",
        "list",
        "--state",
        state,
        "--limit",
        String(limit),
        "--json",
        "number,title,body,state,mergedAt,closedAt,createdAt,url,author,headRefName,baseRefName,changedFiles,additions,deletions,files",
      ];

      if (options.base && options.base.trim()) {
        args.push("--base", options.base.trim());
      }

      if (options.repo && options.repo.trim()) {
        args.push("--repo", options.repo.trim());
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const rawJson = stdout.trim();
      if (!rawJson) {
        return {
          success: true,
          pullRequests: [],
          totalFound: 0,
        };
      }

      const parsed: any[] = JSON.parse(rawJson);
      const cutoffDate = parseSinceDate(options.since, options.sinceHours, options.sinceDays);

      let pullRequests: GitHubPullRequestItem[] = parsed.map((item) => ({
        number: item.number,
        title: item.title,
        body: item.body || "",
        state: item.state,
        mergedAt: item.mergedAt || undefined,
        closedAt: item.closedAt || undefined,
        createdAt: item.createdAt || undefined,
        url: item.url,
        author:
          typeof item.author === "string"
            ? item.author
            : item.author?.login || item.author?.name || "desconhecido",
        headRefName: item.headRefName,
        baseRefName: item.baseRefName,
        changedFiles: item.changedFiles,
        additions: item.additions,
        deletions: item.deletions,
        files: Array.isArray(item.files)
          ? item.files.map((f: any) => ({
              path: f.path,
              additions: f.additions ?? 0,
              deletions: f.deletions ?? 0,
              changeType: f.changeType,
            }))
          : undefined,
      }));

      if (cutoffDate) {
        pullRequests = pullRequests.filter((pr) => {
          const dateStr = pr.mergedAt || pr.closedAt || pr.createdAt;
          if (!dateStr) return true;
          return new Date(dateStr).getTime() >= cutoffDate.getTime();
        });
      }

      return {
        success: true,
        pullRequests,
        totalFound: pullRequests.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh pr list': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Obtém detalhes completos de um Pull Request específico via CLI `gh pr view <number> --json ...`.
   * Opcionalmente inclui o diff do PR se includeDiff for verdadeiro.
   */
  async getPullRequest(
    prNumber: number,
    options: { repo?: string; includeDiff?: boolean } = {}
  ): Promise<GetPullRequestResult> {
    try {
      const args = [
        "pr",
        "view",
        String(prNumber),
        "--json",
        "number,title,body,state,mergedAt,closedAt,createdAt,url,author,headRefName,baseRefName,changedFiles,additions,deletions,files,commits,reviews",
      ];

      if (options.repo && options.repo.trim()) {
        args.push("--repo", options.repo.trim());
      }

      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const rawJson = stdout.trim();
      if (!rawJson) {
        return {
          success: false,
          error: `Pull Request #${prNumber} não encontrado ou vazio.`,
        };
      }

      const parsed = JSON.parse(rawJson);
      const pullRequest: GitHubPullRequestItem = {
        number: parsed.number,
        title: parsed.title,
        body: parsed.body || "",
        state: parsed.state,
        mergedAt: parsed.mergedAt || undefined,
        closedAt: parsed.closedAt || undefined,
        createdAt: parsed.createdAt || undefined,
        url: parsed.url,
        author:
          typeof parsed.author === "string"
            ? parsed.author
            : parsed.author?.login || parsed.author?.name || "desconhecido",
        headRefName: parsed.headRefName,
        baseRefName: parsed.baseRefName,
        changedFiles: parsed.changedFiles,
        additions: parsed.additions,
        deletions: parsed.deletions,
        files: Array.isArray(parsed.files)
          ? parsed.files.map((f: any) => ({
              path: f.path,
              additions: f.additions ?? 0,
              deletions: f.deletions ?? 0,
              changeType: f.changeType,
            }))
          : undefined,
        commits: Array.isArray(parsed.commits)
          ? parsed.commits.map((c: any) => ({
              oid: c.oid || "",
              messageHeadline: c.messageHeadline || "",
              messageBody: c.messageBody || undefined,
              authoredDate: c.authoredDate || undefined,
              authors: c.authors,
            }))
          : undefined,
        reviews: Array.isArray(parsed.reviews)
          ? parsed.reviews.map((r: any) => ({
              author: r.author,
              state: r.state,
              submittedAt: r.submittedAt,
              body: r.body,
            }))
          : undefined,
      };

      let diff: string | undefined;
      if (options.includeDiff) {
        try {
          const diffArgs = ["pr", "diff", String(prNumber)];
          if (options.repo && options.repo.trim()) {
            diffArgs.push("--repo", options.repo.trim());
          }

          const { stdout: diffStdout } = await execFileAsync("gh", diffArgs, {
            cwd: this.projectRoot,
            windowsHide: true,
          });

          const fullDiff = diffStdout.trim();
          diff =
            fullDiff.length > 8000
              ? `${fullDiff.slice(0, 8000)}\n\n[...diff truncado para economia de tokens...]`
              : fullDiff;
        } catch {
          // Erro silencioso ao buscar diff opcional
        }
      }

      return {
        success: true,
        pullRequest,
        diff,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh pr view #${prNumber}': ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Lista commits recentes do repositório via `git log` local ou `gh api` para repo remoto.
   * Suporta filtros por período temporal (since, sinceHours, sinceDays), autor, path e limite.
   */
  async listCommits(options: ListCommitsOptions = {}): Promise<ListCommitsResult> {
    try {
      const limit = Math.min(Math.max(options.limit || 10, 1), 100);
      const cutoffDate = parseSinceDate(options.since, options.sinceHours, options.sinceDays);

      // Se repositório remoto específico for fornecido, consulta via gh api
      if (options.repo && options.repo.trim()) {
        const repo = options.repo.trim();
        let endpoint = `repos/${repo}/commits?per_page=${limit}`;
        if (cutoffDate) {
          endpoint += `&since=${cutoffDate.toISOString()}`;
        }
        if (options.author) {
          endpoint += `&author=${encodeURIComponent(options.author)}`;
        }
        if (options.path) {
          endpoint += `&path=${encodeURIComponent(options.path)}`;
        }

        const { stdout } = await execFileAsync("gh", ["api", endpoint], {
          cwd: this.projectRoot,
          windowsHide: true,
        });

        const rawJson = stdout.trim();
        if (!rawJson) {
          return { success: true, commits: [], totalFound: 0 };
        }

        const parsed: any[] = JSON.parse(rawJson);
        const commits: GitHubCommitItem[] = parsed.map((item) => ({
          hash: item.sha,
          shortHash: (item.sha || "").slice(0, 7),
          authorName: item.commit?.author?.name || item.author?.login || "desconhecido",
          authorEmail: item.commit?.author?.email,
          date: item.commit?.author?.date || item.commit?.committer?.date || "",
          message: item.commit?.message?.split("\n")[0] || "",
        }));

        return {
          success: true,
          commits,
          totalFound: commits.length,
        };
      }

      // Repositório local padrão via git log
      const gitArgs = [
        "log",
        `-n${limit}`,
        "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e",
      ];

      if (cutoffDate) {
        gitArgs.push(`--since=${cutoffDate.toISOString()}`);
      }

      if (options.author && options.author.trim()) {
        gitArgs.push(`--author=${options.author.trim()}`);
      }

      if (options.path && options.path.trim()) {
        gitArgs.push("--", options.path.trim());
      }

      const { stdout } = await execFileAsync("git", gitArgs, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const trimmed = stdout.trim();
      if (!trimmed) {
        return { success: true, commits: [], totalFound: 0 };
      }

      const records = trimmed.split("\x1e").filter((r) => r.trim().length > 0);
      const commits: GitHubCommitItem[] = records.map((rec) => {
        const [hash, shortHash, authorName, authorEmail, date, message] = rec.trim().split("\x1f");
        return {
          hash: hash || "",
          shortHash: shortHash || (hash ? hash.slice(0, 7) : ""),
          authorName: authorName || "desconhecido",
          authorEmail: authorEmail || undefined,
          date: date || "",
          message: message || "",
        };
      });

      return {
        success: true,
        commits,
        totalFound: commits.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao listar commits: ${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Gera um resumo estruturado em linguagem natural (pt-br) sobre Pull Requests mergeados recentemente.
   * Agrupa métricas de volume, destaques por PR, arquivos tocados e síntese de entregas.
   */
  async summarizeMergedPullRequests(
    options: SummarizeMergedOptions = {}
  ): Promise<SummarizeMergedResult> {
    const listResult = await this.listPullRequests({
      ...options,
      state: "merged",
    });

    if (!listResult.success) {
      return {
        success: false,
        totalMerged: 0,
        summary: "",
        error: listResult.error,
      };
    }

    const prs = listResult.pullRequests || [];
    if (prs.length === 0) {
      let periodDesc = "no período selecionado";
      if (options.sinceHours) periodDesc = `nas últimas ${options.sinceHours} horas`;
      else if (options.sinceDays) periodDesc = `nos últimos ${options.sinceDays} dias`;
      else if (options.since) periodDesc = `com o filtro '${options.since}'`;

      return {
        success: true,
        totalMerged: 0,
        pullRequests: [],
        summary: `Nenhum Pull Request mergeado foi encontrado ${periodDesc}.`,
      };
    }

    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalFilesChanged = 0;

    for (const pr of prs) {
      totalAdditions += pr.additions || 0;
      totalDeletions += pr.deletions || 0;
      totalFilesChanged += pr.changedFiles || 0;
    }

    const lines: string[] = [];
    lines.push(`## 📊 Resumo de Entregas: ${prs.length} PR(s) Mergeado(s)`);
    lines.push(`- **Total de PRs**: ${prs.length}`);
    lines.push(
      `- **Impacto no Código**: +${totalAdditions} / -${totalDeletions} linhas alteradas em ~${totalFilesChanged} arquivos`
    );
    lines.push("");
    lines.push("### 🚀 Detalhes das Entregas:");

    for (const pr of prs) {
      const mergeDate = pr.mergedAt
        ? new Date(pr.mergedAt).toLocaleString("pt-BR")
        : "Data indisponível";
      lines.push(`\n#### [#${pr.number}] ${pr.title}`);
      lines.push(`- **Autor**: @${pr.author} | **Mergeado em**: ${mergeDate}`);
      lines.push(`- **URL**: ${pr.url}`);
      lines.push(
        `- **Estatísticas**: +${pr.additions || 0} / -${pr.deletions || 0} (${
          pr.changedFiles || 0
        } arquivos modificados)`
      );

      const cleanBody = (pr.body || "")
        .replace(/>\s*\*Pull Request criado por Benito\.\*/g, "")
        .trim();

      if (cleanBody) {
        const bodyLines = cleanBody.split("\n").map((l) => l.trim()).filter(Boolean);
        const bulletPoints: string[] = [];
        for (const line of bodyLines) {
          if (line.startsWith("- ") || line.startsWith("* ")) {
            bulletPoints.push(`  ${line}`);
            if (bulletPoints.length >= 4) break;
          }
        }

        if (bulletPoints.length > 0) {
          lines.push("- **Principais alterações:**");
          lines.push(...bulletPoints);
        } else {
          const preview = bodyLines.slice(0, 3).join(" ");
          lines.push(
            `- **Descrição**: ${preview.slice(0, 200)}${preview.length > 200 ? "..." : ""}`
          );
        }
      }

      if (options.includeFileList && pr.files && pr.files.length > 0) {
        const fileNames = pr.files
          .slice(0, 5)
          .map((f) => `\`${f.path}\` (+${f.additions}/-${f.deletions})`)
          .join(", ");
        const extra = pr.files.length > 5 ? ` (+${pr.files.length - 5} outros)` : "";
        lines.push(`- **Arquivos modificados**: ${fileNames}${extra}`);
      }
    }

    const summary = lines.join("\n");
    return {
      success: true,
      totalMerged: prs.length,
      pullRequests: prs,
      summary,
    };
  }

  /**
   * Analisa um Pull Request específico (aberto ou concluído), gerando resumo executivo estruturado
   * em português, avaliação de impacto arquitetural (migrações SQL, dependências, .env, breaking changes)
   * e notas de release automáticas.
   */
  async summarizePullRequest(
    prNumber: number,
    options: SummarizePullRequestOptions = {}
  ): Promise<SummarizePullRequestResult> {
    try {
      const viewArgs = [
        "pr",
        "view",
        String(prNumber),
        "--json",
        "number,title,body,state,mergedAt,closedAt,createdAt,url,author,headRefName,baseRefName,changedFiles,additions,deletions,files,commits,reviews",
      ];

      if (options.repo && options.repo.trim()) {
        viewArgs.push("--repo", options.repo.trim());
      }

      const { stdout } = await execFileAsync("gh", viewArgs, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const rawJson = stdout.trim();
      if (!rawJson) {
        return {
          success: false,
          error: `Pull Request #${prNumber} não encontrado ou retorno vazio do gh CLI.`,
        };
      }

      const parsed = JSON.parse(rawJson);
      const author =
        typeof parsed.author === "string"
          ? parsed.author
          : parsed.author?.login || parsed.author?.name || "desconhecido";

      const pullRequest: GitHubPullRequestItem = {
        number: parsed.number,
        title: parsed.title,
        body: parsed.body || "",
        state: parsed.state,
        mergedAt: parsed.mergedAt || undefined,
        closedAt: parsed.closedAt || undefined,
        createdAt: parsed.createdAt || undefined,
        url: parsed.url,
        author,
        headRefName: parsed.headRefName,
        baseRefName: parsed.baseRefName,
        changedFiles: parsed.changedFiles,
        additions: parsed.additions,
        deletions: parsed.deletions,
        files: Array.isArray(parsed.files)
          ? parsed.files.map((f: any) => ({
              path: f.path,
              additions: f.additions ?? 0,
              deletions: f.deletions ?? 0,
              changeType: f.changeType,
            }))
          : undefined,
        commits: Array.isArray(parsed.commits)
          ? parsed.commits.map((c: any) => ({
              oid: c.oid || "",
              messageHeadline: c.messageHeadline || "",
              messageBody: c.messageBody || undefined,
              authoredDate: c.authoredDate || undefined,
              authors: c.authors,
            }))
          : undefined,
        reviews: Array.isArray(parsed.reviews)
          ? parsed.reviews.map((r: any) => ({
              author: r.author,
              state: r.state,
              submittedAt: r.submittedAt,
              body: r.body,
            }))
          : undefined,
      };

      // Busca o diff do PR para análise profunda de impacto e resumo inteligente
      let diff = "";
      try {
        const diffArgs = ["pr", "diff", String(prNumber)];
        if (options.repo && options.repo.trim()) {
          diffArgs.push("--repo", options.repo.trim());
        }

        const { stdout: diffStdout } = await execFileAsync("gh", diffArgs, {
          cwd: this.projectRoot,
          windowsHide: true,
          maxBuffer: 20 * 1024 * 1024,
        });

        diff = diffStdout || "";
      } catch {
        // Diff opcional ou vazio caso falhe
      }

      // Analisa o impacto arquitetural
      const architecturalImpact = analyzeArchitecturalImpact(pullRequest, diff);

      // Resumo inteligente do diff (sem truncamento excessivo)
      const diffSummary = options.includeDiff ? summarizeDiffIntelligently(diff) : undefined;

      // Constrói síntese executiva em linguagem natural (pt-br)
      const summary = buildPullRequestExecutiveSummary(
        pullRequest,
        architecturalImpact,
        diffSummary
      );

      return {
        success: true,
        prNumber: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.url,
        state: pullRequest.state,
        author: pullRequest.author,
        headBranch: pullRequest.headRefName,
        baseBranch: pullRequest.baseRefName,
        stats: {
          additions: pullRequest.additions ?? 0,
          deletions: pullRequest.deletions ?? 0,
          changedFiles: pullRequest.changedFiles ?? (pullRequest.files?.length || 0),
        },
        architecturalImpact,
        summary,
        diffSummary,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar resumo do Pull Request #${prNumber}: ${
          error?.message || String(error)
        }`,
      };
    }
  }
}

/**
 * Avalia o impacto arquitetural e riscos de um Pull Request com base em arquivos alterados,
 * histórico de commits, títulos e diff unificado.
 */
export function analyzeArchitecturalImpact(
  pr: {
    title: string;
    body?: string;
    additions?: number;
    deletions?: number;
    files?: GitHubPullRequestFile[];
    commits?: GitHubPullRequestCommit[];
  },
  diff?: string
): ArchitecturalImpact {
  const sqlFiles: string[] = [];
  const dependencyFiles: string[] = [];
  const envFiles: string[] = [];
  const testFiles: string[] = [];
  const codeFiles: string[] = [];
  const dependencyDetails: string[] = [];
  let sqlDestructive = false;

  const files = pr.files || [];
  for (const f of files) {
    const p = f.path;
    const lowerP = p.toLowerCase();

    // SQL e Migrações de Banco de Dados
    if (
      lowerP.endsWith(".sql") ||
      /(^|\/)(migrations?|prisma\/schema|database\/migrations?|supabase\/migrations?|drizzle\/migrations?)/i.test(
        p
      )
    ) {
      sqlFiles.push(p);
    }

    // Dependências de pacotes e manifestos de terceiros
    if (
      /(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|requirements\.txt|poetry\.lock|Pipfile(\.lock)?|pyproject\.toml|Gemfile(\.lock)?|Cargo\.(toml|lock)|go\.(mod|sum))$/i.test(
        p
      )
    ) {
      dependencyFiles.push(p);
    }

    // Variáveis de ambiente e arquivos sensíveis de configuração
    if (/(\.env(\.|$)|appsettings.*\.json|secrets?\.|wrangler\.toml)/i.test(p)) {
      envFiles.push(p);
    }

    // Testes unitários e de integração
    if (
      /(^|\/)(tests?|__tests__|specs?)\/|(\.(test|spec)\.[a-z0-9]+$)/i.test(p)
    ) {
      testFiles.push(p);
    } else if (
      /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|cs|php|rb|swift|kt)$/i.test(p)
    ) {
      codeFiles.push(p);
    }
  }

  // Análise aprofundada do diff unificado (se fornecido)
  if (diff) {
    // Checagem de comandos SQL destrutivos
    if (sqlFiles.length > 0) {
      const dropRegex =
        /^\+\s*(DROP\s+(TABLE|COLUMN|DATABASE|INDEX|VIEW|SCHEMA|TYPE|SEQUENCE)|TRUNCATE\s+(TABLE\s+)?[a-z0-9_]+|ALTER\s+TABLE\s+.*\s+DROP\s+)/im;
      if (dropRegex.test(diff)) {
        sqlDestructive = true;
      }
    }

    // Extração precisa de pacotes novos ou alterados especificamente em package.json
    if (dependencyFiles.some((f) => /(^|\/)package\.json$/i.test(f))) {
      const fileBlocks = diff.split(/(?=^diff --git )/m);
      const ignoredMetadataKeys = new Set([
        "name",
        "version",
        "description",
        "main",
        "module",
        "types",
        "typings",
        "type",
        "exports",
        "files",
        "author",
        "authors",
        "license",
        "licenses",
        "repository",
        "homepage",
        "bugs",
        "keywords",
        "private",
        "engines",
        "packagemanager",
        "bin",
        "workspaces",
        "publishconfig",
        "scripts",
        "config",
      ]);
      const isVersionSpec = (val: string) =>
        /^[\^~>=<*]|\d+\.\d+|^(latest|beta|next|alpha|rc)|^(npm|workspace|catalog|file|git|github|http):/i.test(
          val.trim()
        );

      for (const block of fileBlocks) {
        const headerMatch = block.match(/^diff --git a\/(\S+) b\/(\S+)/m);
        const filePath = headerMatch ? headerMatch[1] : "";
        if (/(^|\/)package\.json$/i.test(filePath)) {
          const depRegex =
            /^\+\s*"(@?[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?)"\s*:\s*"([^"]+)"/gim;
          let match: RegExpExecArray | null;
          while ((match = depRegex.exec(block)) !== null) {
            const pkgName = match[1];
            const pkgVer = match[2];
            if (
              !ignoredMetadataKeys.has(pkgName.toLowerCase()) &&
              isVersionSpec(pkgVer)
            ) {
              const entry = `${pkgName} (${pkgVer})`;
              if (!dependencyDetails.includes(entry)) {
                dependencyDetails.push(entry);
              }
            }
          }
        }
      }
    }
  }

  // Detecção de Breaking Changes (quebra de compatibilidade)
  const breakingChangeReasons: string[] = [];
  const titleBreaking = /^[a-z]+(\([^\)]+\))?!:/i.test(pr.title);
  if (titleBreaking) {
    breakingChangeReasons.push(`Título indica breaking change com '!:' (${pr.title})`);
  }

  const breakingInBody = /BREAKING[- ]CHANGE(\([^\)]+\))?:/i.test(pr.body || "");
  if (breakingInBody) {
    breakingChangeReasons.push("Menção explícita a 'BREAKING CHANGE' na descrição do PR");
  }

  if (pr.commits && Array.isArray(pr.commits)) {
    for (const c of pr.commits) {
      if (/^[a-z]+(\([^\)]+\))?!:/i.test(c.messageHeadline)) {
        breakingChangeReasons.push(`Commit com breaking change: '${c.messageHeadline}'`);
      } else if (/BREAKING[- ]CHANGE(\([^\)]+\))?:/i.test(c.messageBody || "")) {
        breakingChangeReasons.push(
          `Commit menciona breaking change no corpo: '${c.messageHeadline}'`
        );
      }
    }
  }

  const hasBreakingChanges = breakingChangeReasons.length > 0;
  const hasSqlMigrations = sqlFiles.length > 0;
  const hasDependencyChanges = dependencyFiles.length > 0;
  const hasEnvChanges = envFiles.length > 0;
  const hasTestsIncluded = testFiles.length > 0;

  // Cálculo ponderado do nível de risco arquitetural
  let riskLevel: RiskLevel = "BAIXO";
  const riskReasons: string[] = [];

  if (hasBreakingChanges) {
    riskLevel = "CRÍTICO";
    riskReasons.push(`Quebra de compatibilidade detectada: ${breakingChangeReasons[0]}`);
  }

  if (sqlDestructive) {
    riskLevel = "CRÍTICO";
    riskReasons.push(
      "Migrações SQL destrutivas identificadas (DROP TABLE / DROP COLUMN / TRUNCATE)."
    );
  } else if (hasSqlMigrations) {
    if (riskLevel !== "CRÍTICO") riskLevel = "ALTO";
    riskReasons.push(
      `Contém alterações em migrações de banco de dados SQL (${sqlFiles.length} arquivo(s)).`
    );
  }

  if (hasEnvChanges) {
    if (riskLevel === "BAIXO") riskLevel = "MÉDIO";
    riskReasons.push(
      `Alterações em variáveis de ambiente ou configurações sensíveis (${envFiles.join(", ")}).`
    );
  }

  if (hasDependencyChanges) {
    if (riskLevel === "BAIXO") riskLevel = "MÉDIO";
    const depPreview =
      dependencyDetails.length > 0
        ? ` (${dependencyDetails.slice(0, 3).join(", ")})`
        : "";
    riskReasons.push(`Alterações em dependências de pacotes${depPreview}.`);
  }

  const totalLines = (pr.additions || 0) + (pr.deletions || 0);
  if (totalLines > 1500) {
    if (riskLevel === "BAIXO" || riskLevel === "MÉDIO") riskLevel = "ALTO";
    riskReasons.push(`Volume elevado de código alterado (+${pr.additions}/-${pr.deletions} linhas).`);
  }

  if (codeFiles.length > 0 && !hasTestsIncluded && totalLines > 100) {
    if (riskLevel === "BAIXO") riskLevel = "MÉDIO";
    riskReasons.push(
      "Código de implementação alterado sem inclusão ou atualização de arquivos de teste correspondentes."
    );
  }

  if (riskReasons.length === 0) {
    riskReasons.push("Alterações com baixo risco arquitetural e testes/validação adequados.");
  }

  return {
    hasSqlMigrations,
    sqlFiles,
    sqlDestructive,
    hasDependencyChanges,
    dependencyFiles,
    dependencyDetails: dependencyDetails.length > 0 ? dependencyDetails : undefined,
    hasEnvChanges,
    envFiles,
    hasBreakingChanges,
    breakingChangeReasons,
    hasTestsIncluded,
    testFiles,
    riskLevel,
    riskReasons,
  };
}

/**
 * Condensa um diff unificado inteligentemente para evitar estouro de tokens sem cortar arquivos críticos.
 * Prioriza arquivos SQL, manifestos de dependências, .env e configurações.
 */
export function summarizeDiffIntelligently(diff: string, maxChars: number = 8000): string {
  const trimmed = (diff || "").trim();
  if (!trimmed) return "Diff indisponível ou vazio.";
  if (trimmed.length <= maxChars) return trimmed;

  // Quebra por arquivo: diff --git a/... b/...
  const fileDiffs = trimmed.split(/(?=^diff --git )/m).filter(Boolean);
  if (fileDiffs.length <= 1) {
    return `${trimmed.slice(0, maxChars - 120)}\n\n[...diff truncado inteligentemente para economia de tokens...]`;
  }

  // Padrões de arquivos críticos priorizados no resumo
  const criticalPatterns = [
    /\.sql$/i,
    /migrations?\//i,
    /\.env/i,
    /package\.json/i,
    /pnpm-lock/i,
    /yarn\.lock/i,
    /config\.(ts|js|json)/i,
  ];

  const criticalBlocks: string[] = [];
  const normalBlocks: string[] = [];

  for (const block of fileDiffs) {
    const headerMatch = block.match(/^diff --git a\/(\S+)/m);
    const filePath = headerMatch ? headerMatch[1] : "";
    const isCritical = criticalPatterns.some((pattern) => pattern.test(filePath));

    if (isCritical) {
      criticalBlocks.push(block);
    } else {
      normalBlocks.push(block);
    }
  }

  const resultBlocks: string[] = [];
  let currentLength = 0;
  const reserveCharsForSummary = 250;
  const budget = maxChars - reserveCharsForSummary;

  // Primeiro inclui os blocos críticos
  for (const block of criticalBlocks) {
    if (currentLength + block.length <= budget) {
      resultBlocks.push(block);
      currentLength += block.length;
    } else {
      const sliceSize = budget - currentLength;
      if (sliceSize > 300) {
        resultBlocks.push(
          `${block.slice(0, sliceSize)}\n[...bloco de arquivo crítico condensado...]`
        );
        currentLength += sliceSize;
      }
      break;
    }
  }

  // Em seguida inclui arquivos normais de forma compactada ou amostrada dentro do orçamento
  let compactedFilesCount = 0;
  for (const block of normalBlocks) {
    const headerMatch = block.match(/^diff --git a\/(\S+) b\/(\S+)/m);
    const fileName = headerMatch ? headerMatch[1] : "arquivo";

    // Se o arquivo normal cabe por inteiro no orçamento restante, inclui completo
    if (currentLength + block.length <= budget) {
      resultBlocks.push(block);
      currentLength += block.length;
      continue;
    }

    // Se não cabe completo, inclui os cabeçalhos e uma amostra das primeiras alterações significativas
    const lines = block.split("\n");
    const sampleLines: string[] = [];
    sampleLines.push(`diff --git a/${fileName} b/${fileName}`);

    let changeLinesCount = 0;
    for (const l of lines) {
      if (l.startsWith("@@") || l.startsWith("+") || l.startsWith("-")) {
        sampleLines.push(l);
        if (l.startsWith("+") || l.startsWith("-")) {
          changeLinesCount++;
          if (changeLinesCount >= 12) break;
        }
      }
    }
    sampleLines.push("  [...restante do diff do arquivo omitido para concisão...]");
    const compactSummary = sampleLines.join("\n") + "\n";

    if (currentLength + compactSummary.length <= budget) {
      resultBlocks.push(compactSummary);
      currentLength += compactSummary.length;
    } else {
      compactedFilesCount++;
    }
  }

  let finalDiff = resultBlocks.join("\n");
  if (compactedFilesCount > 0) {
    finalDiff += `\n\n[...diff condensado inteligentemente: ${compactedFilesCount} arquivo(s) adicionais omitidos para economia de contexto...]`;
  }

  return finalDiff;
}

/**
 * Constrói a síntese executiva em Markdown (pt-br) estruturada nas seções:
 * Propósito & Motivação, Principais Mudanças, Arquivos Críticos, Avaliação de Impacto e Notas de Release.
 */
export function buildPullRequestExecutiveSummary(
  pr: GitHubPullRequestItem,
  impact: ArchitecturalImpact,
  diffSummary?: string
): string {
  const lines: string[] = [];

  const riskEmoji = {
    BAIXO: "🟢",
    MÉDIO: "🟡",
    ALTO: "🟠",
    CRÍTICO: "🔴",
  }[impact.riskLevel];

  const stateEmoji =
    pr.state === "MERGED" ? "🟣" : pr.state === "OPEN" ? "🟢" : "🔴";

  // Cabeçalho Executivo
  lines.push(`## 📋 Resumo Executivo: PR #${pr.number} - ${pr.title}`);
  lines.push(
    `- **Autor**: @${pr.author} | **Status**: ${stateEmoji} ${pr.state} | **Branch**: \`${
      pr.headRefName || "origem"
    }\` ➔ \`${pr.baseRefName || "main"}\``
  );
  lines.push(`- **URL**: ${pr.url}`);
  lines.push(
    `- **Impacto no Código**: +${pr.additions ?? 0} / -${pr.deletions ?? 0} linhas em ~${
      pr.changedFiles ?? (pr.files?.length || 0)
    } arquivo(s)`
  );
  lines.push("");

  // 1. Propósito & Motivação
  lines.push("### 🎯 Propósito & Motivação");
  const cleanBody = (pr.body || "")
    .replace(/>\s*\*Pull Request criado por Benito\.\*/g, "")
    .trim();

  // Detecção de issue vinculada (body, commits, branch, título)
  const commitMessages = (pr.commits || [])
    .map((c) => `${c.messageHeadline} ${c.messageBody || ""}`)
    .join(" ");
  const combinedSearchText = `${cleanBody} ${pr.title} ${
    pr.headRefName || ""
  } ${commitMessages}`;

  const issueMatch =
    combinedSearchText.match(
      /(?:(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved|issue|issues)[\s/:-]*#?(\d+))/i
    ) || combinedSearchText.match(/(?:#(\d+)|(?:issue|fix|feat)[\/-](\d+))/i);
  const relatedIssue = issueMatch ? issueMatch[1] || issueMatch[2] : undefined;
  if (relatedIssue) {
    lines.push(`- **Issue Vinculada**: #${relatedIssue}`);
  }

  const genericHeaders =
    /^(?:o que foi implementado|descri[cç][aã]o|contexto|resumo|summary|overview|mudan[cç]as|altera[cç][oõ]es)/i;

  if (cleanBody) {
    const bodyParagraphs = cleanBody
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => !p.startsWith("#") && p.length > 20);

    if (bodyParagraphs.length > 0) {
      lines.push(
        `${bodyParagraphs[0].slice(0, 350)}${
          bodyParagraphs[0].length > 350 ? "..." : ""
        }`
      );
    } else {
      const rawBlocks = cleanBody
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 15 && !p.startsWith("---"));

      const firstContentBlock = rawBlocks.find((b) => {
        const firstLine = b
          .split("\n")[0]
          .replace(/^#+\s*/, "")
          .replace(/^[^\p{L}\p{N}]+/u, "")
          .trim();
        return !genericHeaders.test(firstLine);
      });

      if (firstContentBlock) {
        const cleanBlock = firstContentBlock
          .split("\n")
          .map((l) => (l.startsWith("#") ? `**${l.replace(/^#+\s*/, "")}**` : l))
          .join("\n");
        lines.push(
          `${cleanBlock.slice(0, 400)}${cleanBlock.length > 400 ? "..." : ""}`
        );
      } else {
        lines.push(`Entrega focada em: ${pr.title}`);
      }
    }
  } else {
    lines.push(`Entrega focada em: ${pr.title}`);
  }
  lines.push("");

  // 2. Principais Mudanças
  lines.push("### 🔄 Principais Mudanças");
  if (pr.commits && pr.commits.length > 0) {
    for (const c of pr.commits.slice(0, 6)) {
      lines.push(`- \`${c.oid.slice(0, 7)}\`: ${c.messageHeadline}`);
    }
    if (pr.commits.length > 6) {
      lines.push(`- *(+${pr.commits.length - 6} commits adicionais inclusos no PR)*`);
    }
  } else if (cleanBody) {
    const bullets = cleanBody
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- ") || l.startsWith("* "))
      .slice(0, 5);
    if (bullets.length > 0) {
      lines.push(...bullets);
    } else {
      lines.push(`- ${pr.title}`);
    }
  } else {
    lines.push(`- ${pr.title}`);
  }
  lines.push("");

  // 3. Arquivos Críticos & Áreas Afetadas
  lines.push("### 📁 Arquivos Críticos & Áreas Afetadas");
  if (pr.files && pr.files.length > 0) {
    const sortedFiles = [...pr.files].sort(
      (a, b) => b.additions + b.deletions - (a.additions + a.deletions)
    );
    for (const f of sortedFiles.slice(0, 6)) {
      lines.push(`- \`${f.path}\`: +${f.additions} / -${f.deletions} linhas`);
    }
    if (sortedFiles.length > 6) {
      lines.push(`- *(+${sortedFiles.length - 6} outros arquivos modificados)*`);
    }
  } else {
    lines.push("- Lista detalhada de arquivos não informada pelo repositório.");
  }
  lines.push("");

  // 4. Avaliação de Impacto Arquitetural & Riscos
  lines.push("### ⚠️ Avaliação de Impacto Arquitetural & Riscos");
  lines.push(`- **Nível de Risco Consolidado**: ${riskEmoji} **${impact.riskLevel}**`);
  if (impact.riskReasons.length > 0) {
    for (const reason of impact.riskReasons) {
      lines.push(`  - ${reason}`);
    }
  }
  lines.push("");

  // Destaques explícitos de Banco de Dados, Dependências e .env
  if (impact.hasSqlMigrations) {
    const destructiveAlert = impact.sqlDestructive
      ? " ⚠️ **Comandos destrutivos identificados!**"
      : "";
    lines.push(`- 🗄️ **Banco de Dados & Migrações**: **Impacto Detectado!**${destructiveAlert}`);
    for (const f of impact.sqlFiles.slice(0, 4)) {
      lines.push(`  - Arquivo: \`${f}\``);
    }
  } else {
    lines.push("- 🗄️ **Banco de Dados & Migrações**: Nenhuma migração SQL identificada.");
  }

  if (impact.hasDependencyChanges) {
    lines.push("- 📦 **Dependências de Terceiros**: **Alterações Detectadas!**");
    for (const f of impact.dependencyFiles.slice(0, 3)) {
      lines.push(`  - Manifesto: \`${f}\``);
    }
    if (impact.dependencyDetails && impact.dependencyDetails.length > 0) {
      lines.push(
        `  - Novos pacotes / atualizações: ${impact.dependencyDetails.slice(0, 4).join(", ")}`
      );
    }
  } else {
    lines.push("- 📦 **Dependências de Terceiros**: Nenhuma alteração em dependências externas.");
  }

  if (impact.hasEnvChanges) {
    lines.push("- 🔐 **Variáveis de Ambiente & Config**: **Impacto Detectado!**");
    for (const f of impact.envFiles.slice(0, 4)) {
      lines.push(`  - Arquivo: \`${f}\``);
    }
    lines.push(
      "  - *Recomendação: Validar atualizações necessárias nos arquivos .env locais e pipelines de deploy.*"
    );
  } else {
    lines.push("- 🔐 **Variáveis de Ambiente & Config**: Nenhuma alteração em arquivos de ambiente (.env).");
  }

  if (impact.hasBreakingChanges) {
    lines.push("- 💥 **Quebras de Compatibilidade (Breaking Changes)**: **ATENÇÃO!**");
    for (const r of impact.breakingChangeReasons) {
      lines.push(`  - ${r}`);
    }
  } else {
    lines.push("- 💥 **Quebras de Compatibilidade (Breaking Changes)**: Nenhuma quebra identificada.");
  }

  if (impact.hasTestsIncluded) {
    lines.push(
      `- 🧪 **Cobertura de Testes**: **Testes inclusos/atualizados.** (${impact.testFiles.length} arquivo(s) de teste tocados).`
    );
  } else {
    lines.push(
      "- 🧪 **Cobertura de Testes**: ⚠️ Nenhum arquivo de teste adicionado ou modificado neste PR."
    );
  }
  lines.push("");

  // 5. Notas de Release Sugeridas
  lines.push("### 📝 Notas de Release Sugeridas");
  let releaseNoteDesc = "Atualização aplicada com sucesso.";
  if (cleanBody) {
    const rawLines = cleanBody
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("---"));

    const genericHeaders =
      /^(?:o que foi implementado|descri[cç][aã]o|contexto|resumo|summary|overview|mudan[cç]as|altera[cç][oõ]es)/i;
    const descriptiveLine = rawLines.find((l) => {
      const normalized = l
        .replace(/^#+\s*/, "")
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .trim();
      return (
        normalized.length > 5 &&
        !genericHeaders.test(normalized) &&
        !l.startsWith("![")
      );
    });

    if (descriptiveLine) {
      releaseNoteDesc = descriptiveLine
        .replace(/^#+\s*/, "")
        .replace(/^[-*]\s*/, "")
        .slice(0, 200);
    }
  }
  lines.push(`- **${pr.title}**: ${releaseNoteDesc}`);

  // 6. Amostra do Diff Crítico (quando fornecido via includeDiff)
  if (diffSummary && diffSummary.trim().length > 0) {
    lines.push("");
    lines.push("### 🔍 Amostra do Diff Crítico");
    lines.push("```diff");
    lines.push(diffSummary.trim());
    lines.push("```");
  }

  return lines.join("\n");
}

