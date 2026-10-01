import { tool } from "ai";
import { z } from "zod";
import { config } from "../config.js";

export interface SearxngResultItem {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  publishedDate?: string | null;
  pubdate?: string;
}

export interface SearxngInfobox {
  infobox?: string;
  content?: string;
  urls?: Array<{ title?: string; url?: string }>;
}

export interface SearxngResponse {
  query?: string;
  results?: SearxngResultItem[];
  answers?: string[];
  infoboxes?: SearxngInfobox[];
}

export function sanitizeSearchQuery(rawQuery: string): string {
  let q = rawQuery.trim();
  // Substitui "último modelo", "última corrida", "último lançamento" por termos que indexam notícias reais
  q = q.replace(
    /\b[uú]ltim[oa]s?\s+(modelo|vers[aã]o|lan[cç]amento|update|atualiza[cç][aã]o)\b/gi,
    "novo $1"
  );
  q = q.replace(/(^|\s)[uú]ltim[oa]s?(\s|$)/gi, " novo ");
  // Remove palavras de ruído que poluem a busca
  q = q.replace(/\b(espec[íi]fic[oa]s?|detalhes|exat[oa]s?|qual foi|onde foi)\b/gi, "");
  // Se contiver LLM e uma empresa de tecnologia, expande/substitui por "IA"
  if (/\bLLM\b/i.test(q) && /(google|openai|anthropic|meta|deepmind|microsoft)/i.test(q)) {
    q = q.replace(/\bLLM\b/gi, "IA");
  }
  return q.replace(/\s+/g, " ").trim();
}

export function formatSearchResults(data: SearxngResponse, limit: number): string {
  const sections: string[] = [];

  // Respostas Rápidas / Fatos diretos
  if (data.answers && data.answers.length > 0) {
    const answersText = data.answers.map((ans) => `• ${ans}`).join("\n");
    sections.push(`### 💡 Resposta Rápida:\n${answersText}`);
  }

  // Infoboxes (Wikipedia, entidades em destaque)
  if (data.infoboxes && data.infoboxes.length > 0) {
    const infoboxesText = data.infoboxes
      .slice(0, 2)
      .map((info) => {
        const title = info.infobox ? `**${info.infobox}**: ` : "";
        const content = info.content || "";
        const urls = info.urls?.map((u) => `[${u.title || "Link"}](${u.url})`).join(", ");
        return `${title}${content}${urls ? ` (${urls})` : ""}`;
      })
      .join("\n\n");
    sections.push(`### ℹ️ Informações em Destaque:\n${infoboxesText}`);
  }

  // Resultados de páginas da web
  const items = data.results?.slice(0, limit) || [];
  if (items.length === 0) {
    sections.push("Nenhum resultado relevante encontrado para os termos pesquisados.");
  } else {
    const resultsText = items
      .map((item, index) => {
        const title = item.title?.trim() || "Sem título";
        const url = item.url?.trim() || "";
        const snippet = item.content?.trim() || "Sem descrição disponível.";
        const date = item.publishedDate || item.pubdate;
        const dateBadge = date ? ` [Data: ${date}]` : "";
        const engineBadge = item.engine ? ` (Fonte: ${item.engine})` : "";
        return `${index + 1}. **[${title}](${url})**${dateBadge}${engineBadge}\n   ${snippet}`;
      })
      .join("\n\n");
    sections.push(`### 🌐 Resultados da Busca:\n${resultsText}`);
  }

  return sections.join("\n\n");
}

export function createWebTools() {
  return {
    search_web: tool({
      description:
        "Realiza buscas na internet em tempo real via metabuscador local SearXNG. Utilize para encontrar fatos atuais, lançamentos de IA, notícias recentes, eventos esportivos e datas. IMPORTANTE: Use termos diretos como 'Google anuncia nova IA 2026' ou 'Google novo modelo IA 2026' em vez de palavras conversacionais.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Termos de busca objetivos. Evite a palavra 'último' ou jargões restritivos como 'LLM' (prefira 'novo modelo IA', 'anuncia', 'Gemini', etc.)."
          ),
        numResults: z
          .number()
          .optional()
          .default(5)
          .describe("Número máximo de resultados mais relevantes a retornar (padrão: 5)."),
        categories: z
          .string()
          .optional()
          .default("general,news")
          .describe(
            "Categorias do SearXNG separadas por vírgula. Padrão: 'general,news' (inclui portais gerais e notícias recentes simultaneamente)."
          ),
        language: z
          .string()
          .optional()
          .describe(
            "Código de idioma opcional para filtrar os resultados (ex: 'pt-BR', 'en'). Se omitido, busca automática universal."
          ),
      }),
      execute: async ({ query, numResults = 5, categories = "general,news", language }) => {
        try {
          const effectiveQuery = sanitizeSearchQuery(query);
          const url = new URL("/search", config.searxng.baseUrl);
          url.searchParams.set("q", effectiveQuery);
          url.searchParams.set("format", "json");
          if (categories) {
            url.searchParams.set("categories", categories);
          }
          if (language) {
            url.searchParams.set("language", language);
          }

          const response = await fetch(url.toString(), {
            signal: AbortSignal.timeout(10000),
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            return {
              success: false,
              error: `O SearXNG retornou status HTTP ${response.status} (${response.statusText}).`,
            };
          }

          const data = (await response.json()) as SearxngResponse;
          const summary = formatSearchResults(data, numResults);

          return {
            success: true,
            query: effectiveQuery,
            originalQuery: query !== effectiveQuery ? query : undefined,
            totalFound: data.results?.length || 0,
            resultsCount: Math.min(data.results?.length || 0, numResults),
            summary,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const isConnectionRefused =
            msg.includes("fetch failed") ||
            msg.includes("ECONNREFUSED") ||
            msg.includes("connect") ||
            msg.includes("aborted") ||
            msg.includes("timeout");

          if (isConnectionRefused) {
            return {
              success: false,
              error: `O metabuscador SearXNG está offline ou inacessível em ${config.searxng.baseUrl}. Avise o Luiz Ricardo para iniciar o container Docker executando 'docker start searxng' ou 'docker compose up -d'. Detalhes: ${msg}`,
            };
          }

          return {
            success: false,
            error: `Erro ao realizar busca web no SearXNG: ${msg}`,
          };
        }
      },
    }),
  };
}
