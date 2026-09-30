import { tool } from "ai";
import { z } from "zod";
import { config } from "../config.js";

export interface SearxngResultItem {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
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
        return `${index + 1}. **[${title}](${url})**\n   ${snippet}`;
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
        "Realiza buscas na internet em tempo real via metabuscador local SearXNG. Use quando o usuário pedir informações atuais, notícias, documentação recente, cotações ou fatos externos ao seu conhecimento.",
      parameters: z.object({
        query: z.string().describe("Termos de busca para pesquisar na web."),
        numResults: z
          .number()
          .optional()
          .default(5)
          .describe("Número máximo de resultados mais relevantes a retornar (padrão: 5)."),
        language: z
          .string()
          .optional()
          .describe(
            "Código de idioma opcional para filtrar os resultados (ex: 'pt-BR', 'en'). Se omitido, busca automática universal."
          ),
      }),
      execute: async ({ query, numResults = 5, language }) => {
        try {
          const url = new URL("/search", config.searxng.baseUrl);
          url.searchParams.set("q", query);
          url.searchParams.set("format", "json");
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
            query,
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
