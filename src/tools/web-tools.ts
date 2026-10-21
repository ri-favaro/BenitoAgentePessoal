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

export interface TavilyResultItem {
  title: string;
  url: string;
  content: string;
  score?: number;
  raw_content?: string;
}

export interface TavilyResponse {
  query: string;
  answer?: string;
  results?: TavilyResultItem[];
}

export function formatTavilyResults(data: TavilyResponse, limit: number): string {
  const sections: string[] = [];

  if (data.answer) {
    sections.push(`### 💡 Resposta Direta da Busca (Tavily AI):\n${data.answer}`);
  }

  const items = data.results?.slice(0, limit) || [];
  if (items.length === 0 && !data.answer) {
    sections.push("Nenhum resultado relevante encontrado para os termos pesquisados.");
  } else if (items.length > 0) {
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

/**
 * Sanitização estrutural neutra de consultas de busca para o SearXNG.
 * Princípio Arquitetural: Não faz substituições semânticas ou 'hardcoded' de termos/vocabulário.
 * Apenas limpa caracteres que possam quebrar a sintaxe do motor ou ruídos tipográficos óbvios.
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  return rawQuery
    .replace(/["'“”]/g, "") // Remove aspas que restrinjam buscas sem querer
    .replace(/[?!;:]/g, " ") // Remove pontuação de pergunta conversacional
    .replace(/\s+/g, " ") // Colapsa múltiplos espaços
    .trim();
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
    sections.push(
      "Nenhum resultado relevante encontrado para os termos pesquisados. Dica de formulação: evite termos conversacionais ('location', 'when', 'last'). Use substantivos factuais ('results', 'winner', 'standings', 'calendar') e expanda siglas para seus nomes completos."
    );
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

export function extractPageText(html: string, maxLength: number = 10000): { title: string; content: string } {
  // Extrai título da página
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Sem título";

  // Prioriza o container de conteúdo principal (<article>, <main> ou <div class="entry-content">)
  // para evitar que menus de navegação, cabeçalhos gigantes e barras laterais ocupem o texto
  let bodyHtml = html;
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const entryMatch = html.match(
    /<div\b[^>]*class="[^"]*(?:entry-content|post-content|article-body|story-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );

  if (articleMatch && articleMatch[1].length > 400) {
    bodyHtml = articleMatch[1];
  } else if (mainMatch && mainMatch[1].length > 400) {
    bodyHtml = mainMatch[1];
  } else if (entryMatch && entryMatch[1].length > 400) {
    bodyHtml = entryMatch[1];
  }

  // Remove scripts, styles, comentários, barras laterais, formulários e navegação
  let text = bodyHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, "")
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
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
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

/**
 * Limpa e condensa conteúdo Markdown (gerado pelo Jina Reader),
 * removendo links massivos de imagens webp/png/jpg, badges, comentários e ruídos
 * para que não consumam milhares de tokens preciosos da janela de contexto.
 */
export function cleanMarkdownContent(rawMarkdown: string, maxLength: number = 5000): string {
  let text = rawMarkdown
    // Remove tags de imagens markdown (![alt](url)) que costumam ter centenas de caracteres em URLs
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    // Remove links que apontam puramente para arquivos de imagem
    .replace(/\[\s*\]\([^)]+\.(?:webp|jpg|jpeg|png|gif|svg)[^)]*\)/gi, "")
    // Remove atalhos de navegação comuns
    .replace(/\[(?:Skip to content|Pular para o conteúdo|Voltar ao topo|Menu|Close)\]\([^)]*\)/gi, "")
    // Remove tags e comentários HTML residuais
    .replace(/<!--[\s\S]*?-->/g, "")
    // Compacta espaços horizontais
    .replace(/[ \t]{2,}/g, " ")
    // Compacta quebras de linha múltiplas
    .replace(/\n{3,}/g, "\n\n");

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      // Remove linhas que sobraram apenas com colchetes de links vazios
      if (/^\[\s*\]$/.test(l)) return false;
      return true;
    });

  let clean = lines.join("\n").trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength) + "\n... [Conteúdo restante truncado para economia de tokens]";
  }

  return clean || "Não foi possível extrair texto legível desta página.";
}

export interface WebToolsSessionState {
  knownUrls: Set<string>;
  visitedUrls: Set<string>;
  failedUrls: Set<string>;
  lastQuery?: string;
  clear(): void;
}

export function createWebToolsState(): WebToolsSessionState {
  const knownUrls = new Set<string>();
  const visitedUrls = new Set<string>();
  const failedUrls = new Set<string>();
  return {
    knownUrls,
    visitedUrls,
    failedUrls,
    lastQuery: undefined,
    clear() {
      knownUrls.clear();
      visitedUrls.clear();
      failedUrls.clear();
      this.lastQuery = undefined;
    },
  };
}

export function createWebTools(state: WebToolsSessionState = createWebToolsState()) {
  return {
    search_web: tool({
      description:
        "Realiza buscas na internet em tempo real via metabuscador local SearXNG. Retorna uma lista de links, títulos e snippets resumidos. REGRA UNIVERSAL DE IDIOMA: Para qualquer assunto técnico, documentação, programação, benchmarks, hardware, jogos/simuladores, esportes internacionais ou dados numéricos/específicos, formule a busca prioritariamente em INGLÊS (onde está a maior base de dados e documentação da web). Traga a resposta final sempre traduzida e estruturada em Português do Brasil. Use buscas em português apenas para assuntos de natureza estritamente regional do Brasil.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Palavras-chave factuais de busca (ex: 'FIA Formula 2 race results 2026', 'Amazon Kindle launch 2026'). REGRA CRÍTICA: Motores de busca indexam por substantivos factuais ('results', 'winner', 'standings', 'schedule', 'release') e NÃO por frases conversacionais ('onde foi', 'location', 'date', 'last'). Expanda siglas curtas ('Formula 2' em vez de 'F2') para evitar colisões lexicais. Para assuntos técnicos ou internacionais, use INGLÊS."
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
        timeRange: z
          .enum(["day", "week", "month", "year"])
          .optional()
          .describe(
            "Filtro temporal para buscar apenas publicações recentes ('day' para últimas 24h, 'week' para últimos 7 dias)."
          ),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .describe(
            "Categoria de busca no Tavily ('general' para web ampla, 'news' para notícias em tempo real de portais de imprensa)."
          ),
        days: z
          .number()
          .optional()
          .describe(
            "Número de dias retroativos para filtro de notícias no Tavily (ex: 1 a 3 dias quando topic='news')."
          ),
      }),
      execute: async ({
        query,
        numResults = 5,
        categories = "general,news",
        language,
        timeRange,
        topic,
        days,
      }) => {
        try {
          const effectiveQuery = sanitizeSearchQuery(query);

          // Guarda anti-repetição de busca idêntica consecutiva
          if (
            state.lastQuery &&
            state.lastQuery.toLowerCase() === effectiveQuery.toLowerCase()
          ) {
            return {
              success: false,
              error: `Você já realizou esta exata busca ("${effectiveQuery}") na etapa anterior e recebeu os resultados acima. NÃO repita a mesma query consecutivamente. DICA DE RECUPERAÇÃO: Mude o tipo de termos: substitua palavras conversacionais (como 'location', 'date', 'last') por substantivos factuais (como 'results', 'winner', 'standings', 'schedule') e expanda siglas curtas (ex: use 'Formula 2' em vez de 'F2') ou acione fetch_web_page em um dos links já retornados.`,
            };
          }

          // Se o provedor configurado for Tavily (e tiver API key)
          if (config.searchProvider === "tavily") {
            if (!config.tavily.apiKey) {
              return {
                success: false,
                error:
                  "TAVILY_API_KEY não configurada no arquivo .env. Obtenha uma chave gratuita em https://app.tavily.com e adicione TAVILY_API_KEY=sua_chave no .env, ou alterne SEARCH_PROVIDER=searxng.",
              };
            }

            try {
              const tavilyPayload: Record<string, any> = {
                api_key: config.tavily.apiKey,
                query: effectiveQuery,
                search_depth: "basic",
                include_answer: true,
                max_results: numResults,
              };

              if (topic) {
                tavilyPayload.topic = topic;
              }
              if (days) {
                tavilyPayload.days = days;
              }
              if (timeRange) {
                tavilyPayload.time_range = timeRange;
              }

              const tavilyRes = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tavilyPayload),
                signal: AbortSignal.timeout(12000),
              });

              if (!tavilyRes.ok) {
                const errBody = await tavilyRes.text();
                return {
                  success: false,
                  error: `A API da Tavily retornou status HTTP ${tavilyRes.status}: ${errBody}`,
                };
              }

              const tavilyData = (await tavilyRes.json()) as TavilyResponse;
              const summary = formatTavilyResults(tavilyData, numResults);

              if (tavilyData.results && tavilyData.results.length > 0) {
                for (const item of tavilyData.results) {
                  if (item.url) {
                    const u = item.url.trim();
                    state.knownUrls.add(u);
                    state.knownUrls.add(u.replace(/\/$/, ""));
                  }
                }
              }

              state.lastQuery = effectiveQuery;
              return {
                success: true,
                query: effectiveQuery,
                originalQuery: query !== effectiveQuery ? query : undefined,
                totalFound: tavilyData.results?.length || 0,
                resultsCount: Math.min(tavilyData.results?.length || 0, numResults),
                summary,
              };
            } catch (tavilyErr) {
              const msg = tavilyErr instanceof Error ? tavilyErr.message : String(tavilyErr);
              return {
                success: false,
                error: `Erro ao realizar busca web via Tavily API: ${msg}`,
              };
            }
          }

          // Fallback / Provedor SearXNG
          const url = new URL("/search", config.searxng.baseUrl);
          url.searchParams.set("q", effectiveQuery);
          url.searchParams.set("format", "json");
          if (categories) {
            url.searchParams.set("categories", categories);
          }
          if (language) {
            url.searchParams.set("language", language);
          }
          if (timeRange) {
            url.searchParams.set("time_range", timeRange);
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

          // Registra URLs reais retornadas para evitar alucinações no fetch_web_page
          if (data.results && data.results.length > 0) {
            for (const item of data.results) {
              if (item.url) {
                const u = item.url.trim();
                state.knownUrls.add(u);
                state.knownUrls.add(u.replace(/\/$/, ""));
              }
            }
          }
          state.lastQuery = effectiveQuery;

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
        "Abre uma URL e extrai o conteúdo textual completo do artigo, notícia ou página web (leitura profunda). Use OBRIGATORIAMENTE para ler tabelas de datas de turnês, cronogramas de shows, tempos de voltas e dados que não aparecem completos nos snippets curtos. NUNCA invente dias de cabeça: leia a matéria real. REGRA OBRIGATÓRIA: Passe apenas URLs REAIS retornadas pelo search_web.",
      parameters: z.object({
        url: z
          .string()
          .url()
          .describe("A URL completa da página a ser lida (ex: 'https://exemplo.com/materia')."),
      }),
      execute: async ({ url }) => {
        const cleanUrl = url.trim();
        const normalizedUrl = cleanUrl.replace(/\/$/, "");

        // Guarda 1: Bloqueia URLs que já falharam anteriormente na sessão
        if (state.failedUrls.has(cleanUrl) || state.failedUrls.has(normalizedUrl)) {
          return {
            success: false,
            url: cleanUrl,
            error: `Esta URL já foi consultada e falhou anteriormente (erro de rede ou domínio inexistente). NÃO tente a mesma URL novamente. Formule uma nova busca no search_web com termos em inglês ou selecione outro link diferente da lista de resultados.`,
          };
        }

        // Guarda 2: Bloqueia re-leitura consecutiva de URLs que já foram lidas
        if (state.visitedUrls.has(cleanUrl) || state.visitedUrls.has(normalizedUrl)) {
          return {
            success: false,
            url: cleanUrl,
            error: `Você já leu esta página web anteriormente nesta sessão e já tem o conteúdo dela no contexto. NÃO repita a mesma leitura. Se a informação não estava lá, faça uma nova busca no search_web com termos mais específicos ou escolha outro resultado da lista.`,
          };
        }

        // Guarda 3: Bloqueio estrito de URLs inventadas/adivinhadas que não vieram do search_web
        if (
          state.knownUrls.size > 0 &&
          !state.knownUrls.has(cleanUrl) &&
          !state.knownUrls.has(normalizedUrl)
        ) {
          return {
            success: false,
            url: cleanUrl,
            error: `Acesso negado: a URL "${cleanUrl}" não consta nos resultados retornados pelo search_web. É terminantemente proibido inventar ou adivinhar URLs. Responda imediatamente ao usuário com as informações já presentes nos snippets e infoboxes, ou utilize exclusivamente links reais listados nos resultados do search_web.`,
          };
        }

        try {
          let title = "";
          let content = "";
          let usedJina = false;

          // Tentativa primária: Jina Reader (r.jina.ai) para renderização completa de SPAs (React, Next.js, tabelas)
          try {
            const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
            const jinaRes = await fetch(jinaUrl, {
              signal: AbortSignal.timeout(10000),
              headers: {
                Accept: "text/plain",
                "X-No-Cache": "true",
                "User-Agent": "BenitoPersonalAgent/1.0",
              },
            });

            if (jinaRes.ok) {
              const jinaText = await jinaRes.text();
              if (jinaText && jinaText.length > 200) {
                const titleMatch = jinaText.match(/^Title:\s*(.+)$/m);
                title = titleMatch ? titleMatch[1].trim() : "Sem título";

                const contentStart = jinaText.indexOf("Markdown Content:");
                const rawMarkdown =
                  contentStart !== -1 ? jinaText.slice(contentStart + 17).trim() : jinaText.trim();

                content = cleanMarkdownContent(rawMarkdown, 5000);
                usedJina = true;
              }
            }
          } catch {
            // Jina indisponível ou timeout: segue para o fallback local
          }

          // Fallback: fetch local e extração HTML clássica
          if (!usedJina) {
            const response = await fetch(cleanUrl, {
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
              state.failedUrls.add(cleanUrl);
              state.failedUrls.add(normalizedUrl);
              return {
                success: false,
                url: cleanUrl,
                error: `Falha ao acessar página (HTTP ${response.status}: ${response.statusText}). Não repita esta mesma URL. Escolha outro resultado do search_web.`,
              };
            }

            const html = await response.text();
            const extracted = extractPageText(html, 5000);
            title = extracted.title;
            content = extracted.content;
          }

          state.visitedUrls.add(cleanUrl);
          state.visitedUrls.add(normalizedUrl);

          return {
            success: true,
            url: cleanUrl,
            title,
            content,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          state.failedUrls.add(cleanUrl);
          state.failedUrls.add(normalizedUrl);
          return {
            success: false,
            url: cleanUrl,
            error: `Erro ao ler página web (${msg}). Esta URL falhou e foi bloqueada. Não tente a mesma URL novamente. Formule nova busca no search_web ou selecione outro link dos resultados.`,
          };
        }
      },
    }),
  };
}
