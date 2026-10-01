import { Bot } from "grammy";
import pc from "picocolors";
import { PersonalAgent } from "../core/agent.js";
import { config } from "../config.js";
import {
  isUserAuthorized,
  splitTelegramMessage,
  formatToolFeedback,
} from "./telegram-utils.js";

async function main() {
  if (!config.telegram.botToken) {
    console.error(pc.red("\n✖ Erro: TELEGRAM_BOT_TOKEN não foi configurado no arquivo .env!\n"));
    console.log(pc.yellow("Para configurar o bot do Telegram:"));
    console.log("1. Abra o Telegram e inicie uma conversa com " + pc.cyan("@BotFather"));
    console.log("2. Envie o comando " + pc.green("/newbot") + " e siga as instruções para criar seu bot");
    console.log("3. Copie o token HTTP API gerado e adicione ao seu arquivo .env:");
    console.log(pc.bold(pc.cyan("   TELEGRAM_BOT_TOKEN=seu_token_aqui\n")));
    process.exit(1);
  }

  const agent = new PersonalAgent();
  const bot = new Bot(config.telegram.botToken);

  let agentName = await agent.memoryManager.getAgentName();

  // Fila sequencial (FIFO) por chat para garantir concorrência segura sem sobrecarregar a GPU
  const chatQueues = new Map<number, Promise<void>>();

  function enqueueChatTask(chatId: number, task: () => Promise<void>) {
    const previous = chatQueues.get(chatId) || Promise.resolve();
    const next = previous
      .then(() => task())
      .catch((err) => {
        console.error(pc.red(`[Telegram] Erro na execução da tarefa no chat ${chatId}:`), err);
      });
    chatQueues.set(chatId, next);
    return next;
  }

  // Middleware de Segurança (Whitelist estrita com bloqueio silencioso)
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const userName = ctx.from?.username || ctx.from?.first_name || "Desconhecido";

    if (!isUserAuthorized(userId, config.telegram.allowedUserIds)) {
      console.log(
        pc.yellow(
          `[Telegram] ⚠️ Mensagem bloqueada de usuário não autorizado: ID=${userId} (${userName})`
        )
      );
      if (config.telegram.allowedUserIds.length === 0) {
        console.log(
          pc.cyan(
            `[Telegram] 💡 Dica: Seu TELEGRAM_ALLOWED_USER_ID está vazio no .env. Para autorizar este usuário, configure:\nTELEGRAM_ALLOWED_USER_ID=${userId}\n`
          )
        );
      }
      // Bloqueio silencioso no Telegram
      return;
    }

    await next();
  });

  // Configuração dos comandos nativos no menu da API do Telegram
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Iniciar conversa com o Benito" },
      { command: "status", description: "Ver status do assistente e modelo ativo" },
      { command: "memoria", description: "Ver perfil e memórias gravadas" },
      { command: "regras", description: "Ver persona e regras ativas" },
      { command: "aprendizados", description: "Ver aprendizados operacionais" },
      { command: "topicos", description: "Listar tópicos da memória modular" },
      { command: "consolidar", description: "Sintetizar e organizar memória em tópicos" },
      { command: "limpar", description: "Limpar histórico da sessão atual" },
      { command: "ajuda", description: "Ver lista completa de comandos" },
    ]);
  } catch (err) {
    console.error(pc.dim("[Telegram] Aviso: Não foi possível registrar os comandos no menu nativo:"), err);
  }

  // Helper para envio seguro com fallback de Markdown
  async function safeReply(
    ctx: any,
    text: string,
    options: { parse_mode?: "Markdown" | "HTML" } = {}
  ) {
    const chunks = splitTelegramMessage(text, 4000);
    for (const chunk of chunks) {
      try {
        if (options.parse_mode) {
          await ctx.reply(chunk, { parse_mode: options.parse_mode });
        } else {
          await ctx.reply(chunk);
        }
      } catch {
        // Fallback para texto plano se o markdown for inválido
        await ctx.reply(chunk);
      }
    }
  }

  // Comandos Nativos
  bot.command("start", async (ctx) => {
    agentName = await agent.memoryManager.getAgentName();
    const welcome =
      `🤖 *Olá! Eu sou o ${agentName}, seu agente pessoal local.*\n\n` +
      `Estou conectado ao seu computador e pronto para ajudar com memória persistente, busca web e gerenciamento de notas.\n\n` +
      `*Comandos úteis:*\n` +
      `• /status - Ver modelo e status da sessão\n` +
      `• /memoria - Ver perfil gravado sobre você\n` +
      `• /regras - Ver persona e diretrizes ativas\n` +
      `• /aprendizados - Ver aprendizados acumulados\n` +
      `• /topicos - Ver tópicos modulares de memória\n` +
      `• /consolidar - Organizar a memória em tópicos\n` +
      `• /limpar - Limpar histórico da sessão\n` +
      `• /ajuda - Exibir instruções de uso\n\n` +
      `Pode me enviar qualquer pergunta ou instrução por texto!`;

    await safeReply(ctx, welcome, { parse_mode: "Markdown" });
  });

  bot.command("status", async (ctx) => {
    agentName = await agent.memoryManager.getAgentName();
    const history = agent.getHistory();
    const topics = await agent.memoryManager.listTopics();

    let modelName: string = config.provider;
    if (config.provider === "ollama") modelName = `Ollama (${config.ollama.model})`;
    else if (config.provider === "openai-compatible") modelName = `OpenAI-Comp (${config.openaiCompatible.model})`;
    else if (config.provider === "gemini") modelName = `Gemini (${config.gemini.model})`;

    const searchDesc =
      config.searchProvider === "tavily" ? "Tavily AI Search" : `SearXNG (${config.searxng.baseUrl})`;

    const statusMsg =
      `📊 *Status do Agente: ${agentName}*\n\n` +
      `• *Status:* 🟢 Online (Long Polling)\n` +
      `• *Provedor LLM:* ${modelName}\n` +
      `• *Busca Web:* ${searchDesc}\n` +
      `• *Mensagens na Sessão Atual:* ${history.length}\n` +
      `• *Tópicos Modulares de Memória:* ${topics.length}\n` +
      `• *Diretório de Memória:* \`${config.memoryDir}\``;

    await safeReply(ctx, statusMsg, { parse_mode: "Markdown" });
  });

  bot.command("memoria", async (ctx) => {
    const profile = await agent.memoryManager.readProfile();
    await safeReply(ctx, `🧠 *Memória do Usuário:*\n\n${profile}`, { parse_mode: "Markdown" });
  });

  bot.command("regras", async (ctx) => {
    const rules = await agent.memoryManager.readRules();
    await safeReply(ctx, `📋 *Regras e Persona do Agente:*\n\n${rules}`, { parse_mode: "Markdown" });
  });

  bot.command("aprendizados", async (ctx) => {
    const learnings = await agent.memoryManager.readLearnings();
    await safeReply(ctx, `💡 *Aprendizados Operacionais:*\n\n${learnings}`, { parse_mode: "Markdown" });
  });

  bot.command("topicos", async (ctx) => {
    const topics = await agent.memoryManager.listTopics();
    if (topics.length === 0) {
      await ctx.reply(
        "📂 Nenhum tópico de memória modular criado ainda. Use /consolidar para organizar seus aprendizados em tópicos."
      );
      return;
    }

    let msg = `📂 *Tópicos de Memória Modular (${topics.length}):*\n\n`;
    for (const t of topics) {
      msg += `• \`${t.slug}\` (${t.title}): ${t.description} _[${t.count} regra(s)]_\n`;
    }
    msg += `\nPara ver um tópico específico, envie:\n\`/topico <nome_do_slug>\``;
    await safeReply(ctx, msg, { parse_mode: "Markdown" });
  });

  bot.command("topico", async (ctx) => {
    const text = ctx.message?.text || "";
    const slug = text.replace("/topico", "").trim();
    if (!slug) {
      await ctx.reply("Por favor, especifique o slug do tópico. Exemplo: /topico web-search");
      return;
    }

    const content = await agent.memoryManager.readTopic(slug);
    if (!content) {
      await ctx.reply(`❌ Tópico '${slug}' não encontrado. Use /topicos para listar os existentes.`);
      return;
    }

    await safeReply(ctx, `📂 *Tópico: ${slug.toUpperCase()}*\n\n${content}`, { parse_mode: "Markdown" });
  });

  bot.command("consolidar", async (ctx) => {
    await ctx.reply("🧠 Benito está analisando o histórico recente e organizando a memória em tópicos. Aguarde um instante...");
    const history = agent.getHistory();
    try {
      const result = await agent.memoryManager.consolidateMemory(undefined, history);
      if (result.success) {
        await safeReply(
          ctx,
          `✔ *Memória consolidada com sucesso!*\n\n*Resumo:*\n${result.summary}`,
          { parse_mode: "Markdown" }
        );
      } else {
        await ctx.reply(`❌ Falha na consolidação: ${result.summary}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao consolidar memória: ${msg}`);
    }
  });

  bot.command("limpar", async (ctx) => {
    agent.clearHistory();
    await ctx.reply("🧹 Histórico da conversa atual limpo com sucesso! Uma nova sessão foi iniciada.");
  });

  bot.command("ajuda", async (ctx) => {
    const helpMsg =
      `📖 *Comandos Disponíveis:*\n\n` +
      `• /status - Ver status do assistente, modelo e busca\n` +
      `• /memoria - Ver perfil e fatos registrados sobre você\n` +
      `• /regras - Ver persona e diretrizes ativas do Benito\n` +
      `• /aprendizados - Ver feedbacks e lições aprendidas\n` +
      `• /topicos - Listar tópicos modulares em memory/topics/\n` +
      `• /topico <slug> - Ver conteúdo detalhado de um tópico\n` +
      `• /consolidar - Organizar e sintetizar a memória em tópicos\n` +
      `• /limpar - Limpar a sessão de mensagens atual\n` +
      `• /ajuda - Exibir esta lista de comandos\n\n` +
      `_Você pode enviar mensagens normais de texto a qualquer momento para conversar._`;
    await safeReply(ctx, helpMsg, { parse_mode: "Markdown" });
  });

  // Avisos amigáveis para mensagens que não sejam texto
  bot.on(["message:voice", "message:audio"], async (ctx) => {
    await ctx.reply(
      "🎙️ *Mensagem de voz recebida:*\n" +
      "Olá! No momento ainda aceito apenas mensagens de texto e comandos. " +
      "O suporte a transcrição e áudio será implementado em breve! Por favor, envie sua mensagem por texto.",
      { parse_mode: "Markdown" }
    );
  });

  bot.on(
    ["message:photo", "message:video", "message:document", "message:sticker"],
    async (ctx) => {
      await ctx.reply(
        "📎 *Mídia recebida:*\n" +
        "No momento eu trabalho apenas com mensagens de texto e comandos. " +
        "Por favor, envie sua dúvida ou instrução por texto!",
        { parse_mode: "Markdown" }
      );
    }
  );

  // Processamento de mensagens de texto regulares com Streaming Debounced e Fila FIFO
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const userInput = ctx.message.text.trim();

    if (!userInput || userInput.startsWith("/")) return;

    // Enfileira a mensagem para processamento sequencial garantido
    enqueueChatTask(chatId, async () => {
      let isDone = false;

      // Mantém o indicador nativo "typing" ativo enquanto processa
      const typingInterval = setInterval(() => {
        if (!isDone) {
          ctx.replyWithChatAction("typing").catch(() => {});
        }
      }, 4000);

      ctx.replyWithChatAction("typing").catch(() => {});

      let placeholderMsg: any = null;
      try {
        placeholderMsg = await ctx.reply("⏳ Benito está pensando...");
      } catch (err) {
        console.error(pc.red("[Telegram] Erro ao enviar mensagem inicial:"), err);
      }

      let accumulatedTokens = "";
      let activeToolStatus = "";
      let lastEditTime = Date.now();
      let editPending = false;
      let editTimer: NodeJS.Timeout | null = null;

      const performEdit = async (isFinal = false) => {
        if (!placeholderMsg) return;

        let contentToDisplay = accumulatedTokens.trim();
        if (activeToolStatus && !contentToDisplay) {
          contentToDisplay = activeToolStatus;
        } else if (activeToolStatus && contentToDisplay) {
          contentToDisplay = `${contentToDisplay}\n\n_${activeToolStatus}_`;
        }

        if (!contentToDisplay) {
          contentToDisplay = "⏳ Benito está pensando...";
        }

        // Garante que o texto parcial não estoure o limite de 4000 caracteres
        if (contentToDisplay.length > 4000) {
          contentToDisplay = contentToDisplay.slice(0, 3950) + "\n... [continua]";
        }

        try {
          if (isFinal) {
            await ctx.api.editMessageText(
              chatId,
              placeholderMsg.message_id,
              contentToDisplay,
              { parse_mode: "Markdown" }
            );
          } else {
            // Em streaming intermediário, markdown incompleto pode falhar; tentamos Markdown com fallback
            try {
              await ctx.api.editMessageText(
                chatId,
                placeholderMsg.message_id,
                contentToDisplay,
                { parse_mode: "Markdown" }
              );
            } catch {
              await ctx.api.editMessageText(
                chatId,
                placeholderMsg.message_id,
                contentToDisplay
              );
            }
          }
          lastEditTime = Date.now();
        } catch (editErr: any) {
          // Ignora mensagens idênticas ou rate limit temporário
          const errMsg = editErr?.message || "";
          if (
            !errMsg.includes("message is not modified") &&
            !errMsg.includes("retry after")
          ) {
            // Fallback para edição sem markdown
            try {
              await ctx.api.editMessageText(
                chatId,
                placeholderMsg.message_id,
                contentToDisplay
              );
              lastEditTime = Date.now();
            } catch {}
          }
        }
      };

      const scheduleEdit = (force = false) => {
        const elapsed = Date.now() - lastEditTime;
        if (force || elapsed >= 1500) {
          if (editTimer) {
            clearTimeout(editTimer);
            editTimer = null;
          }
          editPending = false;
          performEdit(false);
        } else if (!editPending) {
          editPending = true;
          editTimer = setTimeout(() => {
            editPending = false;
            performEdit(false);
          }, 1500 - elapsed);
        }
      };

      try {
        console.log(pc.cyan(`\n[Telegram] Mensagem recebida: "${userInput}"`));

        const finalResult = await agent.ask(userInput, {
          onToken: (chunk) => {
            accumulatedTokens += chunk;
            scheduleEdit(false);
          },
          onToolCall: (toolName, args) => {
            activeToolStatus = formatToolFeedback(toolName, args);
            console.log(pc.dim(`[Telegram Tool] ${activeToolStatus}`));
            scheduleEdit(true);
          },
        });

        isDone = true;
        clearInterval(typingInterval);
        if (editTimer) clearTimeout(editTimer);

        const finalText = finalResult.trim() || accumulatedTokens.trim() || "(Sem resposta gerada)";
        const chunks = splitTelegramMessage(finalText, 4000);

        // Edita a mensagem inicial com a primeira parte
        if (placeholderMsg && chunks.length > 0) {
          try {
            await ctx.api.editMessageText(
              chatId,
              placeholderMsg.message_id,
              chunks[0],
              { parse_mode: "Markdown" }
            );
          } catch {
            await ctx.api.editMessageText(
              chatId,
              placeholderMsg.message_id,
              chunks[0]
            );
          }
        }

        // Se houver mais de uma parte (>4000 caracteres), envia as restantes em novas mensagens
        for (let i = 1; i < chunks.length; i++) {
          try {
            await ctx.reply(chunks[i], { parse_mode: "Markdown" });
          } catch {
            await ctx.reply(chunks[i]);
          }
        }

        console.log(pc.green(`[Telegram] Resposta entregue com sucesso (${finalText.length} caracteres).`));
      } catch (err: unknown) {
        isDone = true;
        clearInterval(typingInterval);
        if (editTimer) clearTimeout(editTimer);

        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(pc.red(`[Telegram] Erro ao processar mensagem:`), errorMsg);

        if (placeholderMsg) {
          try {
            await ctx.api.editMessageText(
              chatId,
              placeholderMsg.message_id,
              `❌ Ocorreu um erro ao processar sua solicitação: ${errorMsg}`
            );
          } catch {
            await ctx.reply(`❌ Ocorreu um erro ao processar sua solicitação: ${errorMsg}`);
          }
        } else {
          await ctx.reply(`❌ Ocorreu um erro: ${errorMsg}`);
        }
      }
    });
  });

  // Banner informativo no console
  console.log("\n" + pc.bold(pc.cyan("==================================================")));
  console.log(pc.bold(pc.cyan(`       ${agentName.toUpperCase()} - INTERFACE TELEGRAM BOT               `)));
  console.log(pc.bold(pc.cyan("==================================================")));
  console.log(pc.gray(`• Provedor atual: `) + pc.green(config.provider));
  if (config.provider === "ollama") {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.ollama.model));
    console.log(pc.gray(`• Endpoint: `) + pc.blue(config.ollama.baseUrl));
  } else if (config.provider === "openai-compatible") {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.openaiCompatible.model));
    console.log(pc.gray(`• Endpoint: `) + pc.blue(config.openaiCompatible.baseUrl));
  } else {
    console.log(pc.gray(`• Modelo: `) + pc.yellow(config.gemini.model));
  }
  console.log(pc.gray(`• Memória: `) + pc.magenta(config.memoryDir));
  const searchDesc =
    config.searchProvider === "tavily"
      ? `Tavily AI Search (api.tavily.com)`
      : `SearXNG (${config.searxng.baseUrl})`;
  console.log(pc.gray(`• Busca Web: `) + pc.blue(searchDesc));
  console.log(
    pc.gray(`• Usuários Autorizados: `) +
      (config.telegram.allowedUserIds.length > 0
        ? pc.green(config.telegram.allowedUserIds.join(", "))
        : pc.red("Nenhum (configure TELEGRAM_ALLOWED_USER_ID no .env)"))
  );
  console.log(pc.gray("--------------------------------------------------"));
  console.log(pc.green("✔ Bot do Benito conectado ao Telegram com sucesso!"));
  console.log(pc.dim("Aguardando mensagens via Long Polling... (Pressione Ctrl+C para encerrar)\n"));

  // Tratamento de encerramento gracioso
  const stopHandler = () => {
    console.log(pc.yellow("\nEncerrando conexão com o Telegram..."));
    bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", stopHandler);
  process.once("SIGTERM", stopHandler);

  // Inicia o bot via Long Polling
  await bot.start();
}

main().catch((err) => {
  console.error(pc.red("Falha crítica ao iniciar o Telegram Bot:"), err);
  process.exit(1);
});
