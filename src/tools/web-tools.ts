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

export function extractPageText(html: string, maxLength: number = 4000): { title: string; content: string } {
  // Extrai título da página
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Sem título";

  // Remove scripts, styles, comentários e tags de navegação/rodapé
  let text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");

  // Substitui quebras semânticas por quebras de linha
  text = text
    .replace(/<\/(p|div|h[1-6]|li|article|section|tr)>/gi, "\n")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<td\b[^>]*>/gi, " | ")
    .replace(/<th\b[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ");

  // Decodifica entidades HTML comuns
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // Filtra linhas vazias
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const cleanContent = lines.join("\n").slice(0, maxLength);

  return {
    title,
    content: cleanContent || "Não foi possível extrair texto legível desta página.",
  };
}

export function createWebTools() {
  return {
    search_web: tool({
      description:
        "Realiza buscas na internet em tempo real via metabuscador local SearXNG. Retorna uma lista de links, títulos e snippets resumidos. Use para encontrar as melhores fontes antes de aprofundar.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Termos de busca objetivos. Evite a palavra 'último' ou jargões restritivos como 'LLM' (prefira 'novo modelo IA', 'anuncia', 'Gemini', 'F1 resultado', etc.)."
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

    fetch_web_page: tool({
      description:
        "Abre uma URL e extrai o conteúdo textual completo do artigo, notícia ou página web (leitura profunda). Use SEMPRE que os snippets de search_web forem muito curtos, quando precisar verificar cronogramas de shows/turnês, calendários esportivos, tabelas de datas ou ler a matéria jornalística completa antes de responder.",
      parameters: z.object({
        url: z
          .string()
          .url()
          .describe("A URL completa da página a ser lida (ex: 'https://exemplo.com/materia')."),
      }),
      execute: async ({ url }) => {
        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(12000),
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            },
          });

          if (!response.ok) {
            return {
              success: false,
              url,
              error: `Falha ao acessar página (HTTP ${response.status}: ${response.statusText}).`,
            };
          }

          const html = await response.text();
          const { title, content } = extractPageText(html, 4000);

          return {
            success: true,
            url,
            title,
            content,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            url,
            error: `Erro ao ler página web: ${msg}`,
          };
        }
      },
    }),
  };
}
