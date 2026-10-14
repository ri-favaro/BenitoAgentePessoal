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
  };
}
