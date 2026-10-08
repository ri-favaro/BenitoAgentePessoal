import { tool } from "ai";
import { z } from "zod";
import path from "node:path";
import { EmbeddingService } from "../core/embedding-service.js";
import { VectorStore } from "../core/vector-store.js";
import { KnowledgeIndexer } from "../core/indexer.js";
import { validateAllowedPath } from "./path-guard.js";

export function createRetrievalTools(
  vectorStore: VectorStore,
  embeddingService: EmbeddingService,
  indexer: KnowledgeIndexer,
  allowedPaths: string[],
  vaultPath: string
) {
  return {
    search_codebase: tool({
      description:
        "Busca semântica vetorial em arquivos de código em todos os repositórios autorizados (ex: Benito, CONTELE-OS). Localiza funções, classes, regras de negócio ou lógicas específicas em milissegundos sem precisar listar diretórios.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Pergunta técnica, descrição funcional ou trecho de código a ser localizado (ex: 'onde validamos o token JWT?', 'calculo de burn rate das financas')"
          ),
        project: z
          .string()
          .optional()
          .describe(
            "Filtro opcional por nome do projeto/repositório (ex: 'contele-os', 'ProjetoAgentePessoal', 'feat-retrieval-integra-o-do-embeddinggemma-2-ggu'). Se omitido, busca em todos os repositórios autorizados."
          ),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Quantidade máxima de trechos de código retornados (padrão: 5, máx: 15)"),
      }),
      execute: async ({ query, project, limit = 5 }) => {
        try {
          // Validação de projeto contra diretórios autorizados
          if (project) {
            const normalizedProject = project.toLowerCase().trim();
            const projectDir = allowedPaths.find((dir) => {
              const base = path.basename(dir).toLowerCase();
              return base === normalizedProject || base.includes(normalizedProject);
            });

            if (!projectDir) {
              return {
                success: false,
                error: `Acesso negado ou projeto desconhecido: '${project}'. Projetos autorizados disponíveis: [${allowedPaths.map((d) => path.basename(d)).join(", ")}]`,
              };
            }
          }

          // Gera o vetor de busca
          const queryVector = await embeddingService.getEmbedding(query);
          const maxLimit = Math.min(Math.max(1, limit), 15);

          // Executa busca vetorial
          const matches = await vectorStore.searchCodebase(queryVector, {
            project,
            limit: maxLimit,
          });

          // Valida sandbox para cada resultado retornado
          const safeMatches = matches.filter((m) => {
            const check = validateAllowedPath(m.filePath, allowedPaths);
            return check.allowed;
          });

          if (safeMatches.length === 0) {
            return {
              success: true,
              query,
              projectFilter: project || "todos",
              resultsCount: 0,
              message:
                "Nenhum trecho de código relevante encontrado. Caso arquivos tenham sido adicionados recentemente, use a ferramenta 'reindex_knowledge' ou execute 'npm run index'.",
              results: [],
            };
          }

          return {
            success: true,
            query,
            projectFilter: project || "todos",
            resultsCount: safeMatches.length,
            results: safeMatches.map((item) => ({
              project: item.project,
              relativePath: item.relativePath,
              filePath: item.filePath,
              lines: `${item.startLine}-${item.endLine}`,
              similarity: item.similarity,
              snippet: item.content,
            })),
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao realizar busca no codebase: ${error.message}`,
          };
        }
      },
    }),

    search_vault: tool({
      description:
        "Busca semântica vetorial no cofre do Obsidian (notas de estudo, atas, decisões arquiteturais e regras de negócio). Localiza notas e seções pelo significado.",
      parameters: z.object({
        query: z
          .string()
          .describe("Pergunta, tema ou termo a ser pesquisado nas notas do cofre"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Quantidade máxima de notas/seções retornadas (padrão: 5, máx: 15)"),
      }),
      execute: async ({ query, limit = 5 }) => {
        try {
          // Validação de segurança no caminho do cofre
          const vaultCheck = validateAllowedPath(vaultPath, [
            vaultPath,
            ...allowedPaths,
          ]);
          if (!vaultCheck.allowed) {
            return {
              success: false,
              error: `Acesso negado ao cofre do Obsidian: ${vaultCheck.error}`,
            };
          }

          const queryVector = await embeddingService.getEmbedding(query);
          const maxLimit = Math.min(Math.max(1, limit), 15);

          const matches = await vectorStore.searchVault(queryVector, {
            limit: maxLimit,
          });

          if (matches.length === 0) {
            return {
              success: true,
              query,
              resultsCount: 0,
              message:
                "Nenhuma nota encontrada no cofre para esta consulta. Certifique-se de que o cofre foi indexado com 'reindex_knowledge' ou 'npm run index'.",
              results: [],
            };
          }

          return {
            success: true,
            query,
            resultsCount: matches.length,
            results: matches.map((item) => ({
              title: item.title,
              heading: item.heading,
              relativePath: item.relativePath,
              similarity: item.similarity,
              snippet: item.content,
            })),
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao realizar busca no cofre do Obsidian: ${error.message}`,
          };
        }
      },
    }),

    reindex_knowledge: tool({
      description:
        "Dispara a indexação incremental baseada em hash SHA-256 dos repositórios de código e/ou do cofre do Obsidian. Deve ser chamada caso novos arquivos tenham sido criados ou modificados.",
      parameters: z.object({
        target: z
          .enum(["all", "codebase", "vault"])
          .default("all")
          .describe(
            "Alvo da indexação: 'codebase' (repositórios de código), 'vault' (notas do Obsidian) ou 'all' (ambos)"
          ),
      }),
      execute: async ({ target = "all" }) => {
        try {
          const summaries: any = {};

          if (target === "all" || target === "codebase") {
            summaries.codebase = await indexer.indexCodebase(allowedPaths);
          }

          if (target === "all" || target === "vault") {
            summaries.vault = await indexer.indexVault(vaultPath);
          }

          return {
            success: true,
            target,
            summaries,
            message: "Indexação incremental concluída com sucesso.",
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar reindexação de conhecimento: ${error.message}`,
          };
        }
      },
    }),
  };
}
