import { generateText } from "ai";
import { Bot } from "grammy";
import pc from "picocolors";
import { config } from "../../config.js";
import { getLanguageModel } from "../../core/llm.js";
import { createWebTools, type WebToolsSessionState } from "../../tools/web-tools.js";
import { splitTelegramMessage } from "../../interfaces/telegram-utils.js";

export interface TopicSearchResult {
  topic: string;
  found: boolean;
  content: string;
  error?: string;
}

export interface DailyNewsDigestResult {
  success: boolean;
  digest: string;
  topicsProcessed: number;
  topicResults: TopicSearchResult[];
  error?: string;
}

export interface GenerateDigestOptions {
  topics?: string[];
  customSearchTool?: (query: string) => Promise<{ success: boolean; summary?: string; error?: string }>;
  customModel?: ReturnType<typeof getLanguageModel>;
  targetDate?: Date;
}

export interface ExecuteDigestOptions extends GenerateDigestOptions {
  bot?: Bot;
  chatIds?: number[];
  sendTelegram?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * Coleta as notícias recentes da web e gera um resumo executivo formatado com a LLM.
 */
export async function generateNewsDigest(
  options: GenerateDigestOptions = {}
): Promise<DailyNewsDigestResult> {
  const topics = options.topics || config.automation.digestTopics;
  const targetDate = options.targetDate || new Date();
  const dateFormatted = targetDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (topics.length === 0) {
    return {
      success: false,
      digest: "Nenhum tópico configurado para o Daily News Digest.",
      topicsProcessed: 0,
      topicResults: [],
      error: "Lista de tópicos vazia.",
    };
  }

  const topicResults: TopicSearchResult[] = [];
  const webTools = createWebTools();

  for (const topic of topics) {
    try {
      const searchAction = options.customSearchTool
        ? options.customSearchTool(topic)
        : (async () => {
            // Busca primária: Notícias frescas dos últimos 3 dias via portal de notícias (Tavily topic: news)
            const primaryQuery = `${topic} news`;
            let result: any = await webTools.search_web.execute(
              {
                query: primaryQuery,
                numResults: 4,
                categories: "news,general",
                topic: "news",
                days: 3,
                timeRange: "day",
              },
              { messages: [], toolCallId: `digest-${Date.now()}` }
            );

            // Fallback resiliente: se o filtro estrito de 3 dias não encontrar novidades, expande para 7 dias
            if (result.success && (!result.summary || result.totalFound === 0)) {
              result = await webTools.search_web.execute(
                {
                  query: `${topic} latest updates`,
                  numResults: 4,
                  categories: "general,news",
                  timeRange: "week",
                },
                { messages: [], toolCallId: `digest-fallback-${Date.now()}` }
              );
            }

            return {
              success: result.success,
              summary: result.summary,
              error: result.error,
            };
          })();

      const searchRes = await searchAction;

      if (searchRes.success && searchRes.summary) {
        topicResults.push({
          topic,
          found: true,
          content: searchRes.summary,
        });
      } else {
        topicResults.push({
          topic,
          found: false,
          content: "Nenhum resultado recente encontrado.",
          error: searchRes.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      topicResults.push({
        topic,
        found: false,
        content: `Falha ao pesquisar tópico: ${msg}`,
        error: msg,
      });
    }
  }

  // Monta o payload de contexto para a LLM sintetizar
  const contextParts = topicResults.map((tr) => {
    return `### TÓPICO: ${tr.topic}\n${tr.content}\n`;
  });

  const model = options.customModel || getLanguageModel();
  const systemPrompt = `Você é o Benito, assistente pessoal de engenharia de software e produtividade de Luiz Ricardo.
Sua missão é gerar o Daily News Digest matinal/executivo para o Telegram com base nos dados coletados na web.

DIRETRIZES ESTREITAS DE FORMATAÇÃO:
1. Saudação inicial elegante citando a data de hoje (${dateFormatted}).
2. Agrupe as notícias por tópicos claros e objetivos usando títulos e emojis (ex: 🤖 Inteligência Artificial, 💻 Engenharia & Código, ⚡ Notícias Gerais).
3. Para cada item relevante, traga:
   - Uma síntese do fato em 1 a 2 frases claras e densas.
   - Link de referência em Markdown no formato [Nome da Fonte](URL) SOMENTE se a URL estiver explicitamente presente no texto da busca. NUNCA invente ou alucine URLs.
4. Se um tópico específico não teve notícias relevantes, mencione brevemente de forma profissional (ex: "Sem destaques relevantes nas últimas 24h").
5. Conclusão breve e motivacional para o dia de trabalho.
6. Mantenha formatação em Markdown limpo compatível com Telegram (títulos em negrito com **, listas com bullet points •).
7. Escreva sempre em Português do Brasil (pt-br).`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Aqui estão os resultados brutos da busca na web para os tópicos de interesse:\n\n${contextParts.join("\n---\n")}\n\nPor favor, sintetize o Daily News Digest executivo seguindo as diretrizes.`,
      temperature: 0.25,
    });

    return {
      success: true,
      digest: text.trim(),
      topicsProcessed: topics.length,
      topicResults,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(pc.red("[DailyNewsDigest] Erro ao gerar síntese via LLM:"), err);

    // Fallback: se a LLM falhar, entrega uma compilação estruturada direta dos resultados
    const fallbackText = [
      `📰 **Daily News Digest - ${dateFormatted}**`,
      `*(Síntese direta dos dados coletados)*\n`,
      ...topicResults.map((tr) => `**• ${tr.topic}**\n${tr.content.slice(0, 300)}...\n`),
    ].join("\n");

    return {
      success: false,
      digest: fallbackText,
      topicsProcessed: topics.length,
      topicResults,
      error: errorMsg,
    };
  }
}

/**
 * Executa o Daily News Digest e distribui via Telegram para os usuários autorizados.
 */
export async function executeDailyNewsDigest(
  options: ExecuteDigestOptions = {}
): Promise<{ success: boolean; digest: string; sentChats: number[]; error?: string }> {
  options.onProgress?.("Iniciando coleta e síntese de notícias do Daily Digest...");
  const digestResult = await generateNewsDigest(options);

  const sentChats: number[] = [];
  const targetChats = options.chatIds || config.telegram.allowedUserIds;
  const shouldSendTelegram =
    options.sendTelegram !== false &&
    Boolean(options.bot || config.telegram.botToken) &&
    targetChats.length > 0;

  if (shouldSendTelegram) {
    const bot = options.bot || (config.telegram.botToken ? new Bot(config.telegram.botToken) : null);

    if (bot) {
      const chunks = splitTelegramMessage(digestResult.digest, 3900);

      for (const chatId of targetChats) {
        try {
          options.onProgress?.(`Enviando digest para o Telegram (Chat ID: ${chatId})...`);
          for (const chunk of chunks) {
            try {
              await bot.api.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
            } catch {
              // Se o Markdown do Telegram falhar por caracteres especiais, envia em texto puro
              await bot.api.sendMessage(chatId, chunk);
            }
          }
          sentChats.push(chatId);
        } catch (err) {
          console.error(
            pc.red(`[DailyNewsDigest] Falha ao enviar mensagem para chat ${chatId}:`),
            err
          );
        }
      }
    }
  }

  return {
    success: digestResult.success,
    digest: digestResult.digest,
    sentChats,
    error: digestResult.error,
  };
}

