import { tool } from "ai";
import { z } from "zod";
import { GitHubService } from "../core/github-service.js";

export function createGitHubTools(gitHubService?: GitHubService) {
  const service = gitHubService || new GitHubService();

  return {
    create_github_issue: tool({
      description:
        "Cria uma nova issue no repositório do GitHub com título descritivo, corpo detalhado e labels. ATENÇÃO OBRIGATÓRIA: NUNCA acione esta ferramenta sem antes propor a minuta no chat (título e escopo) e obter confirmação ou autorização explícita do usuário (Human-in-the-Loop).",
      parameters: z.object({
        title: z
          .string()
          .describe(
            "Título da issue seguindo o formato Conventional Commits (ex: 'feat(tools): adicionar suporte a X', 'fix(core): corrigir erro em Y')."
          ),
        body: z
          .string()
          .describe(
            "Descrição completa da issue em Markdown, contendo seções como Contexto & Motivação, Requisitos Técnicos Sugeridos e Critérios de Aceite."
          ),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Lista de labels adicionais para a issue (ex: ['enhancement', 'bug']). A label 'benito-sugestao' é anexada automaticamente."
          ),
        repo: z
          .string()
          .optional()
          .describe(
            "Repositório alvo no formato 'owner/repo' (ex: 'ri-favaro/BenitoAgentePessoal'). Se omitido, utiliza o repositório atual do projeto."
          ),
      }),
      execute: async ({ title, body, labels, repo }) => {
        try {
          const result = await service.createIssue({ title, body, labels, repo });
          if (result.success) {
            return {
              success: true,
              url: result.url,
              issueNumber: result.issueNumber,
              message: `Issue criada com sucesso no GitHub: ${result.url}`,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar create_github_issue: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    list_github_issues: tool({
      description:
        "Consulta e lista issues no repositório do GitHub. Permite inspecionar o backlog atual antes de propor melhorias para evitar duplicatas, ou para checar tarefas e pendências já mapeadas.",
      parameters: z.object({
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .default("open")
          .describe(
            "Filtrar por estado das issues: 'open' (abertas), 'closed' (fechadas) ou 'all' (todas). Padrão: 'open'."
          ),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Quantidade máxima de issues a retornar (de 1 a 50). Padrão: 10."),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Filtrar issues por labels específicas (ex: ['enhancement', 'benito-sugestao'])."
          ),
        repo: z
          .string()
          .optional()
          .describe(
            "Repositório alvo no formato 'owner/repo'. Se omitido, utiliza o repositório atual do projeto."
          ),
      }),
      execute: async ({ state, limit, labels, repo }) => {
        try {
          const result = await service.listIssues({ state, limit, labels, repo });
          if (result.success) {
            const issues = result.issues || [];
            const summary =
              issues.length > 0
                ? issues
                    .map(
                      (i) =>
                        `#${i.number} [${i.state}] ${i.title} (${
                          i.labels.join(", ") || "sem labels"
                        }) - ${i.url}`
                    )
                    .join("\n")
                : "Nenhuma issue encontrada com os filtros informados.";

            return {
              success: true,
              totalFound: result.totalFound ?? issues.length,
              issues,
              summary,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar list_github_issues: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    get_github_issue: tool({
      description:
        "Consulta os detalhes completos de uma issue específica do GitHub (título, descrição detalhada em Markdown, estado, labels e URL). Útil para inspecionar requisitos e empacotar tarefas de implementação para agentes de coding.",
      parameters: z.object({
        issueNumber: z
          .number()
          .describe("Número identificador da issue no GitHub (ex: 15, 21)."),
        repo: z
          .string()
          .optional()
          .describe(
            "Repositório alvo no formato 'owner/repo'. Se omitido, utiliza o repositório atual do projeto."
          ),
      }),
      execute: async ({ issueNumber, repo }) => {
        try {
          const result = await service.getIssue(issueNumber, repo);
          if (result.success && result.issue) {
            const issue = result.issue;
            return {
              success: true,
              issue,
              summary: `#${issue.number} [${issue.state}] ${issue.title}\nLabels: ${
                issue.labels.join(", ") || "sem labels"
              }\nURL: ${issue.url}\n\n${issue.body}`,
            };
          }

          return {
            success: false,
            error: result.error || `Issue #${issueNumber} não encontrada.`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar get_github_issue: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    create_github_pr: tool({
      description:
        "Abre um novo Pull Request (PR) no GitHub para propor alterações de código já implementadas em uma branch. ATENÇÃO OBRIGATÓRIA (HUMAN-IN-THE-LOOP): NUNCA acione esta ferramenta sem antes propor a minuta no chat (título, branch e escopo) e obter autorização expressa do Luiz Ricardo. NUNCA confunda PR com Issue.",
      parameters: z.object({
        title: z
          .string()
          .describe(
            "Título do Pull Request seguindo Conventional Commits em português do Brasil (ex: 'feat(tools): adicionar suporte a PRs')."
          ),
        body: z
          .string()
          .describe(
            "Descrição detalhada do Pull Request em Markdown (motivação, o que foi alterado e como testar)."
          ),
        headBranch: z
          .string()
          .optional()
          .describe(
            "Nome da branch de origem contendo as alterações (ex: 'feat/issue-29-leitura-prs'). Se omitido, usa a branch atual."
          ),
        baseBranch: z
          .string()
          .optional()
          .default("main")
          .describe("Branch de destino do Pull Request (padrão: 'main')."),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Labels adicionais para o PR. A label 'benito-pr' é adicionada automaticamente."
          ),
        draft: z
          .boolean()
          .optional()
          .default(false)
          .describe("Se true, cria o PR como rascunho (Draft PR)."),
        repo: z
          .string()
          .optional()
          .describe(
            "Repositório alvo no formato 'owner/repo'. Se omitido, utiliza o repositório atual do projeto."
          ),
      }),
      execute: async ({ title, body, headBranch, baseBranch, labels, draft, repo }) => {
        try {
          const result = await service.createPullRequest({
            title,
            body,
            headBranch,
            baseBranch,
            labels,
            draft,
            repo,
          });

          if (result.success) {
            return {
              success: true,
              url: result.url,
              prNumber: result.prNumber,
              message: `Pull Request criado com sucesso no GitHub: ${result.url}`,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar create_github_pr: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    list_github_prs: tool({
      description:
        "Lista Pull Requests do repositório via GitHub CLI (gh pr list). Permite filtrar por estado ('merged', 'open', 'closed', 'all') e por período temporal (sinceHours ou sinceDays).",
      parameters: z.object({
        state: z
          .enum(["open", "closed", "merged", "all"])
          .optional()
          .default("merged")
          .describe("Filtrar por estado do PR. Padrão: 'merged'."),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Quantidade máxima de PRs a retornar (1 a 50). Padrão: 10."),
        sinceHours: z
          .number()
          .optional()
          .describe("Filtrar PRs atualizados ou mergeados nas últimas X horas."),
        sinceDays: z
          .number()
          .optional()
          .describe("Filtrar PRs atualizados ou mergeados nos últimos X dias."),
        base: z
          .string()
          .optional()
          .describe("Filtrar pela branch de destino (ex: 'main')."),
        repo: z
          .string()
          .optional()
          .describe("Repositório opcional 'owner/repo'."),
      }),
      execute: async ({ state, limit, sinceHours, sinceDays, base, repo }) => {
        try {
          const result = await service.listPullRequests({
            state,
            limit,
            sinceHours,
            sinceDays,
            base,
            repo,
          });

          if (result.success) {
            const prs = result.pullRequests || [];
            const summary =
              prs.length > 0
                ? prs
                    .map(
                      (p) =>
                        `#${p.number} [${p.state}] ${p.title} (@${p.author}) - ${p.url}`
                    )
                    .join("\n")
                : "Nenhum Pull Request encontrado com os filtros informados.";

            return {
              success: true,
              totalFound: result.totalFound ?? prs.length,
              pullRequests: prs,
              summary,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar list_github_prs: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    get_github_pr: tool({
      description:
        "Obtém detalhes estruturados e arquivos modificados de um Pull Request específico via GitHub CLI (gh pr view). Opcionalmente inclui o diff das alterações.",
      parameters: z.object({
        prNumber: z
          .number()
          .describe("Número identificador do Pull Request no GitHub."),
        includeDiff: z
          .boolean()
          .optional()
          .default(false)
          .describe("Se true, inclui o diff unificado das alterações."),
        repo: z
          .string()
          .optional()
          .describe("Repositório opcional 'owner/repo'."),
      }),
      execute: async ({ prNumber, includeDiff, repo }) => {
        try {
          const result = await service.getPullRequest(prNumber, {
            includeDiff,
            repo,
          });

          if (result.success && result.pullRequest) {
            return {
              success: true,
              pullRequest: result.pullRequest,
              diff: result.diff,
            };
          }

          return {
            success: false,
            error: result.error || `Pull Request #${prNumber} não encontrado.`,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar get_github_pr: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    list_recent_commits: tool({
      description:
        "Lista os commits recentes do repositório local ou remoto. Permite inspecionar hashes, autores, datas e mensagens para acompanhar o histórico de alterações.",
      parameters: z.object({
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Quantidade máxima de commits (1 a 100). Padrão: 10."),
        sinceHours: z
          .number()
          .optional()
          .describe("Filtrar commits das últimas X horas."),
        sinceDays: z
          .number()
          .optional()
          .describe("Filtrar commits dos últimos X dias."),
        author: z
          .string()
          .optional()
          .describe("Filtrar commits por nome ou email do autor."),
        path: z
          .string()
          .optional()
          .describe("Filtrar commits que alteraram determinado arquivo ou diretório."),
        repo: z
          .string()
          .optional()
          .describe("Repositório remoto opcional 'owner/repo'."),
      }),
      execute: async ({ limit, sinceHours, sinceDays, author, path, repo }) => {
        try {
          const result = await service.listCommits({
            limit,
            sinceHours,
            sinceDays,
            author,
            path,
            repo,
          });

          if (result.success) {
            const commits = result.commits || [];
            const summary =
              commits.length > 0
                ? commits
                    .map(
                      (c) =>
                        `[${c.shortHash}] ${c.message} (${c.authorName}, ${c.date})`
                    )
                    .join("\n")
                : "Nenhum commit encontrado no período informado.";

            return {
              success: true,
              totalFound: result.totalFound ?? commits.length,
              commits,
              summary,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar list_recent_commits: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    summarize_merged_prs: tool({
      description:
        "Gera um resumo executivo estruturado em linguagem natural (pt-br) sobre Pull Requests mergeados recentemente, incluindo métricas de linhas alteradas, destaques de cada PR e arquivos tocados.",
      parameters: z.object({
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Quantidade máxima de PRs mergeados a incluir no resumo."),
        sinceHours: z
          .number()
          .optional()
          .describe("Filtrar PRs mergeados nas últimas X horas."),
        sinceDays: z
          .number()
          .optional()
          .describe("Filtrar PRs mergeados nos últimos X dias."),
        includeFileList: z
          .boolean()
          .optional()
          .default(true)
          .describe("Se true, lista arquivos modificados em cada PR."),
        base: z
          .string()
          .optional()
          .describe("Filtrar por branch de destino (ex: 'main')."),
        repo: z
          .string()
          .optional()
          .describe("Repositório opcional 'owner/repo'."),
      }),
      execute: async ({ limit, sinceHours, sinceDays, includeFileList, base, repo }) => {
        try {
          const result = await service.summarizeMergedPullRequests({
            limit,
            sinceHours,
            sinceDays,
            includeFileList,
            base,
            repo,
          });

          if (result.success) {
            return {
              success: true,
              totalMerged: result.totalMerged,
              summary: result.summary,
              pullRequests: result.pullRequests,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar summarize_merged_prs: ${error?.message || String(error)}`,
          };
        }
      },
    }),

    summarize_github_pr: tool({
      description:
        "Gera um resumo executivo estruturado e avaliação de impacto arquitetural de um Pull Request específico (aberto ou concluído), inspecionando título, corpo, commits, arquivos e diff. Analisa riscos, migrações SQL, dependências, variáveis de ambiente (.env) e breaking changes.",
      parameters: z.object({
        prNumber: z
          .number()
          .describe("Número identificador do Pull Request no GitHub (ex: 12, 16, 33)."),
        repo: z
          .string()
          .optional()
          .describe(
            "Repositório alvo no formato 'owner/repo' (ex: 'ri-favaro/BenitoAgentePessoal' ou 'contele-os'). Se omitido, utiliza o repositório atual do projeto."
          ),
        includeDiff: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Se true, anexa o diff inteligente condensado das alterações mais críticas no retorno."
          ),
      }),
      execute: async ({ prNumber, repo, includeDiff }) => {
        try {
          const result = await service.summarizePullRequest(prNumber, {
            repo,
            includeDiff,
          });

          if (result.success) {
            return {
              success: true,
              prNumber: result.prNumber,
              title: result.title,
              url: result.url,
              state: result.state,
              author: result.author,
              stats: result.stats,
              riskLevel: result.architecturalImpact?.riskLevel,
              architecturalImpact: result.architecturalImpact,
              summary: result.summary,
              diffSummary: result.diffSummary,
            };
          }

          return {
            success: false,
            error: result.error,
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar summarize_github_pr: ${error?.message || String(error)}`,
          };
        }
      },
    }),
  };
}
