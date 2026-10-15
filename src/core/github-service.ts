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
        "number,title,body,state,mergedAt,closedAt,createdAt,url,author,headRefName,baseRefName,changedFiles,additions,deletions,files",
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
}

