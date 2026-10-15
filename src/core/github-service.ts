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
}

