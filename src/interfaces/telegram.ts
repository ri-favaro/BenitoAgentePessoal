import path from "node:path";
import fsSync from "node:fs";
import { Bot, InputFile } from "grammy";
import pc from "picocolors";
import { PersonalAgent } from "../core/agent.js";
import { config } from "../config.js";
import { createFinanceTools, formatBRL, resolveMonthQuery } from "../tools/finance-tools.js";
import {
  isUserAuthorized,
  splitTelegramMessage,
  formatToolFeedback,
  SessionTracker,
  parseTelegramRetryAfter,
  TelegramRateLimiter,
} from "./telegram-utils.js";
import { SelfAuditor } from "../core/self-auditor.js";
import { KnowledgeIndexer } from "../core/indexer.js";
import { EmbeddingService } from "../core/embedding-service.js";
import { VectorStore } from "../core/vector-store.js";
import {
  createAutomationScheduler,
  executeDailyNewsDigest,
} from "../automation/index.js";
import { createObsidianTools } from "../tools/obsidian-tools.js";
import {
  createCareerTools,
  loadAnalyzedJobs,
  formatJobPipelineKanban,
  type JobApplicationStatus,
} from "../tools/career-tools.js";

export interface TelegramBotHandle {
  stop: () => void;
  promise: Promise<void>;
}

export async function startTelegramBot(options: { handleSignals?: boolean; background?: boolean } = {}): Promise<TelegramBotHandle> {
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
  const financeTools = createFinanceTools(config.finance.financeDir, config.filesystem.allowedPaths);
  const obsidianTools = createObsidianTools(
    config.obsidian.vaultPath,
    config.obsidian.dailyNotesDir,
    config.filesystem.allowedPaths
  );
  const careerTools = createCareerTools(config.obsidian.vaultPath, config.filesystem.allowedPaths);
  const auditor = new SelfAuditor();
  const embeddingService = new EmbeddingService();
  const vectorStore = new VectorStore();
  const indexer = new KnowledgeIndexer(embeddingService, vectorStore);
  const sessionTracker = new SessionTracker(config.telegram.sessionTimeoutMinutes);
  const rateLimiter = new TelegramRateLimiter();
  const bot = new Bot(config.telegram.botToken);
  const scheduler = createAutomationScheduler(bot);
  scheduler.startAll();

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
      { command: "carreira", description: "Ver gaps de mercado e vagas analisadas" },
      { command: "financas", description: "Ver resumo financeiro e saldo do mês" },
      { command: "auditar", description: "Executar auto-auditoria do sistema" },
      { command: "reindex", description: "Reindexar repositórios e notas do cofre" },
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
      `• /hoje - Ver a Daily Note do dia no Obsidian\n` +
      `• /tarefas - Listar tarefas e checkboxes abertas\n` +
      `• /digest - Gerar e receber o Daily News Digest agora\n` +
      `• /financas - Ver extrato financeiro e saldo do mês\n` +
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

    const timeoutMin = sessionTracker.getTimeoutMinutes();
    const ttlDesc = timeoutMin > 0 ? `${timeoutMin} min` : "Desativado";
    const inactiveMin = sessionTracker.getInactiveMinutes(ctx.chat.id);
    const inactiveDesc =
      inactiveMin !== null ? ` (última interação há ${inactiveMin} min)` : " (nova sessão)";

    const automationDesc = config.automation.digestEnabled
      ? `🟢 Ativo (\`${config.automation.digestCronSchedule}\`)`
      : "🔴 Desativado";

    const statusMsg =
      `📊 *Status do Agente: ${agentName}*\n\n` +
      `• *Status:* 🟢 Online (Long Polling)\n` +
      `• *Provedor LLM:* ${modelName}\n` +
      `• *Busca Web:* ${searchDesc}\n` +
      `• *Daily Digest:* ${automationDesc}\n` +
      `• *Mensagens na Sessão Atual:* ${history.length}\n` +
      `• *TTL de Inatividade:* ${ttlDesc}${inactiveDesc}\n` +
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
    sessionTracker.updateActivity(ctx.chat.id);
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

  bot.command("financas", async (ctx) => {
    try {
      const rawText = ctx.message?.text || "";
      const argsText = rawText.replace(/^\/financas(@\w+)?/i, "").trim();
      const resolved = resolveMonthQuery(argsText);

      const summaryResult: any = await (financeTools.get_financial_summary as any).execute({
        month: resolved.yearMonth,
        wallet: resolved.wallet,
      });

      if (!summaryResult.success) {
        await ctx.reply(`❌ Erro ao consultar finanças: ${summaryResult.error}`);
        return;
      }

      let msg = `💰 *Extrato Financeiro - ${summaryResult.monthTitle}*\n\n`;

      if (summaryResult.wallets) {
        for (const [wKey, wData] of Object.entries<any>(summaryResult.wallets)) {
          if (wKey === "conta_corrente") {
            msg += `💳 *Conta Corrente (Dinheiro Livre):*\n`;
            msg += `• Receitas: ${formatBRL(wData.totalIncome)}\n`;
            msg += `• Despesas: ${formatBRL(wData.totalExpense)}\n`;
            msg += `• *Saldo Livre:* ${formatBRL(wData.balance)}\n\n`;
          } else if (wKey === "va") {
            msg += `🍎 *Vale Alimentação (VA):*\n`;
            msg += `• Benefício: ${formatBRL(wData.totalIncome)}\n`;
            msg += `• Gastos no VA: ${formatBRL(wData.totalExpense)}\n`;
            msg += `• *Saldo VA:* ${formatBRL(wData.balance)}\n\n`;
          } else {
            msg += `📁 *${wData.label}:*\n`;
            msg += `• Entradas: ${formatBRL(wData.totalIncome)} | Saídas: ${formatBRL(wData.totalExpense)}\n`;
            msg += `• *Saldo:* ${formatBRL(wData.balance)}\n\n`;
          }
        }
      } else {
        msg += `🟢 *Receitas:* ${summaryResult.totalIncome}\n`;
        msg += `🔴 *Despesas:* ${summaryResult.totalExpense}\n`;
        msg += `⚖️ *Saldo Líquido:* ${summaryResult.balance}\n\n`;
      }

      if (summaryResult.masterBalances) {
        msg += `🏦 *Saldos Acumulados (Saldo Mestre):*\n`;
        for (const [, wState] of Object.entries<any>(summaryResult.masterBalances)) {
          msg += `• ${wState.label}: *${formatBRL(wState.balance)}*\n`;
        }
        msg += `\n`;
      }

      msg += `⏱️ *Ritmo Médio (Conta Corrente):* ${summaryResult.dailyBurnRate}/dia\n`;

      if (summaryResult.burnAlert) {
        msg += `\n${summaryResult.burnAlert}\n`;
      }

      if (summaryResult.expenseCategories && summaryResult.expenseCategories.length > 0) {
        msg += `\n📊 *Principais Despesas por Categoria:*\n`;
        for (const cat of summaryResult.expenseCategories.slice(0, 5)) {
          msg += `• ${cat.category}: ${cat.total}\n`;
        }
      }

      if (summaryResult.recentTransactions && summaryResult.recentTransactions.length > 0) {
        msg += `\n📝 *Últimos Lançamentos:*\n`;
        for (const t of summaryResult.recentTransactions.slice(0, 3)) {
          const typeIcon = t.type === "income" ? "🟢" : "🔴";
          const walletIcon = t.wallet === "va" ? "🍎" : "💳";
          msg += `• ${typeIcon} ${walletIcon} ${t.description}: ${formatBRL(t.amount)} (${t.category})\n`;
        }
      }

      await safeReply(ctx, msg, { parse_mode: "Markdown" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao carregar finanças: ${errorMsg}`);
    }
  });

  bot.command("auditar", async (ctx) => {
    await ctx.reply("🛡️ *Iniciando auto-auditoria do sistema...*", { parse_mode: "Markdown" });
    try {
      const report = await auditor.runAudit();
      let msg = `🛡️ *RELATÓRIO DE AUTO-AUDITORIA*\n\n`;

      msg += `⏱️ *Desempenho & Raciocínio:*\n`;
      msg += `• Turnos analisados: ${report.performance.totalTurns}\n`;
      msg += `• Duração média: ${report.performance.avgDurationMs}ms\n`;
      msg += `• Turnos lentos (> 15s): ${report.performance.slowTurnsCount}\n\n`;

      msg += `🛡️ *Conformidade de Sandbox (path-guard):*\n`;
      if (report.sandboxViolations.length === 0) {
        msg += `✔ 100% das ferramentas utilizam validação estrita de sandbox!\n\n`;
      } else {
        for (const v of report.sandboxViolations) {
          msg += `✖ \`${v.file}\`: ${v.issue}\n`;
        }
        msg += `\n`;
      }

      msg += `🧪 *Cobertura de Módulos:*\n`;
      if (report.testGaps.length === 0) {
        msg += `✔ Todos os módulos de ferramentas e core possuem testes!\n\n`;
      } else {
        for (const g of report.testGaps) {
          msg += `⚠️ Sem teste: \`${g.sourceModule}\`\n`;
        }
        msg += `\n`;
      }

      const proposal = auditor.generateIssueProposal(report);
      if (proposal) {
        msg += `📋 *Minuta de Issue Técnica Sugerida:*\n`;
        msg += `*Título:* \`${proposal.title}\`\n\n`;
        msg += `_Para revisar e autorizar a abertura no GitHub, utilize o comando /auditar no terminal CLI do Benito._`;
      } else {
        msg += `🎉 *Projeto em excelente conformidade! Nenhuma issue necessária.*`;
      }

      await safeReply(ctx, msg, { parse_mode: "Markdown" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao executar auditoria: ${errorMsg}`);
    }
  });

  bot.command("reindex", async (ctx) => {
    await ctx.reply("⚙️ *Iniciando reindexação incremental de código e cofre...*", { parse_mode: "Markdown" });
    try {
      const isOnline = await embeddingService.isAvailable();
      if (!isOnline) {
        await ctx.reply(
          `❌ O serviço de embeddings está offline em ${config.embedding.baseUrl}.\n` +
          `Inicie-o no seu PC via terminal com: \`npm run embedding:serve\``,
          { parse_mode: "Markdown" }
        );
        return;
      }

      const codeSummary = await indexer.indexCodebase(config.filesystem.allowedPaths);
      const vaultSummary = await indexer.indexVault(config.finance.vaultPath);

      let msg = `✔ *Indexação Concluída com Sucesso!*\n\n`;
      msg += `📂 *Codebase:*\n`;
      msg += `• Atualizados: ${codeSummary.filesIndexed}\n`;
      msg += `• Inalterados: ${codeSummary.filesSkipped}\n`;
      msg += `• Duração: ${codeSummary.durationMs}ms\n\n`;
      msg += `📓 *Obsidian Vault:*\n`;
      msg += `• Atualizados: ${vaultSummary.filesIndexed}\n`;
      msg += `• Inalterados: ${vaultSummary.filesSkipped}\n`;
      msg += `• Duração: ${vaultSummary.durationMs}ms\n`;

      await safeReply(ctx, msg, { parse_mode: "Markdown" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao reindexar: ${errorMsg}`);
    }
  });

  bot.command("limpar", async (ctx) => {
    agent.clearHistory();
    sessionTracker.resetSession(ctx.chat.id);
    await ctx.reply("🧹 Histórico da conversa atual limpo com sucesso! Uma nova sessão foi iniciada.");
  });

  bot.command("digest", async (ctx) => {
    await ctx.reply("⏳ *Gerando o Daily News Digest executivo agora...*", {
      parse_mode: "Markdown",
    });
    try {
      const result = await executeDailyNewsDigest({
        bot,
        chatIds: [ctx.chat.id],
        sendTelegram: true,
      });
      if (!result.success && result.error) {
        await ctx.reply(`⚠️ Aviso durante a geração do Digest: ${result.error}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Falha ao processar o Daily News Digest: ${errorMsg}`);
    }
  });

  bot.command("hoje", async (ctx) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res: any = await (obsidianTools.get_daily_note as any).execute({ date: today });
      if (!res.exists || !res.content) {
        await ctx.reply(
          `📅 *Daily Note de Hoje (${today}) ainda não foi criada.*\n\n` +
          `Para registrar uma nota, tarefa ou gasto, envie uma mensagem como:\n` +
          `• _"Anote na daily note de hoje: reunião com a equipe às 14h"_\n` +
          `• _"Adicione a tarefa: estudar LanceDB para hoje"_`,
          { parse_mode: "Markdown" }
        );
      } else {
        await safeReply(ctx, res.content, { parse_mode: "Markdown" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao consultar Daily Note: ${msg}`);
    }
  });

  bot.command("tarefas", async (ctx) => {
    try {
      const res: any = await (obsidianTools.list_vault_tasks as any).execute({
        status: "open",
        limit: 30,
      });
      if (!res.success) {
        await ctx.reply(`❌ Erro ao buscar tarefas: ${res.error}`);
      } else {
        await safeReply(ctx, res.summary, { parse_mode: "Markdown" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro ao listar tarefas: ${msg}`);
    }
  });

  bot.command("carreira", async (ctx) => {
    try {
      const text = ctx.message?.text || "";
      const args = text.replace(/^\/carreira(@\w+)?/i, "").trim().toLowerCase();

      if (args.startsWith("pdf ")) {
        const targetComp = text.replace(/^\/carreira(@\w+)?\s+pdf\s+/i, "").trim();
        if (!targetComp) {
          await ctx.reply("💼 *Uso:* `/carreira pdf <empresa>`", { parse_mode: "Markdown" });
          return;
        }
        const res: any = await (careerTools.export_resume_pdf as any).execute({ company: targetComp });
        if (res.success && res.cvPdfFilePath && fsSync.existsSync(res.cvPdfFilePath)) {
          await ctx.reply(`✔ *${res.message}*`, { parse_mode: "Markdown" });
          await ctx.replyWithDocument(new InputFile(res.cvPdfFilePath));
        } else {
          await ctx.reply(`❌ ${res.error || "Não foi possível exportar o PDF."}`);
        }
        return;
      }
      if (args.startsWith("status ")) {
        const raw = text.replace(/^\/carreira(@\w+)?\s+status\s+/i, "").trim();
        const parts = raw.split(/\s+/);
        if (parts.length < 2) {
          await ctx.reply(
            "💼 *Uso:* `/carreira status <empresa_ou_id> <novo_status>`\n\n*Status válidos:* `analisada`, `cv_gerado`, `aplicada`, `entrevista`, `rejeitada`, `oferta`\n*Exemplo:* `/carreira status Implanta aplicada`",
            { parse_mode: "Markdown" }
          );
          return;
        }
        const newStatus = parts[parts.length - 1].toLowerCase() as JobApplicationStatus;
        const targetComp = parts.slice(0, -1).join(" ");
        const validStatuses = ["analisada", "cv_gerado", "aplicada", "entrevista", "rejeitada", "oferta"];
        if (!validStatuses.includes(newStatus)) {
          await ctx.reply(`❌ Status inválido: \`${newStatus}\`. Use: ${validStatuses.join(", ")}`, { parse_mode: "Markdown" });
          return;
        }
        const res: any = await (careerTools.update_job_application_status as any).execute({
          company: targetComp,
          status: newStatus,
        });
        if (res.success) {
          await ctx.reply(`✔ *Status atualizado!*\n\n${res.message}`, { parse_mode: "Markdown" });
        } else {
          await ctx.reply(`❌ ${res.error}`);
        }
        return;
      }

      if (args === "vagas" || args === "listar") {
        const jobs = await loadAnalyzedJobs(config.obsidian.vaultPath, config.filesystem.allowedPaths);
        if (jobs.length === 0) {
          await ctx.reply(
            "💼 *Nenhuma vaga analisada encontrada ainda.*\n\nEnvie o link ou texto de uma vaga no chat para o Benito analisar!",
            { parse_mode: "Markdown" }
          );
          return;
        }

        const kanban = formatJobPipelineKanban(jobs);
        const msg = `💼 *Funil de Candidaturas (${jobs.length}):*\n\n\`\`\`\n${kanban}\`\`\`\n_Dica: Para atualizar o status, envie:_\n\`/carreira status <empresa> <status>\``;
        await safeReply(ctx, msg, { parse_mode: "Markdown" });
      } else {
        await ctx.reply("📊 *Consolidando relatório de mercado e gaps de carreira...*", { parse_mode: "Markdown" });
        const res: any = await (careerTools.generate_career_report as any).execute({ updateVaultNote: true });
        if (!res.success) {
          await ctx.reply(`❌ Erro ao gerar relatório: ${res.error}`);
        } else if (res.totalJobsAnalyzed === 0 || res.totalJobs === 0) {
          await ctx.reply(res.message || "Nenhuma vaga cadastrada ainda.");
        } else {
          await safeReply(ctx, res.reportMarkdown, { parse_mode: "Markdown" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.reply(`❌ Erro no comando de carreira: ${msg}`);
    }
  });

  bot.command("ajuda", async (ctx) => {
    const helpMsg =
      `📖 *Comandos Disponíveis:*\n\n` +
      `• /status - Ver status do assistente, modelo e busca\n` +
      `• /hoje - Ver a Daily Note do dia no Obsidian\n` +
      `• /tarefas - Listar tarefas e checkboxes abertas no cofre\n` +
      `• /carreira - Ver gaps de mercado e matriz de estudos para Pleno\n` +
      `• /carreira vagas - Ver o funil de candidaturas (Kanban)\n` +
      `• /carreira status - Atualizar status de candidatura (/carreira status <empresa> <status>)\n` +
      `• /digest - Gerar e receber o Daily News Digest agora\n` +
      `• /financas - Ver extrato financeiro e saldo do mês\n` +
      `• /auditar - Executar auto-auditoria técnica do projeto\n` +
      `• /reindex - Reindexar repositórios de código e cofre Obsidian\n` +
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
      // Verificação de expiração automática por inatividade (TTL)
      if (sessionTracker.isExpired(chatId)) {
        const inactiveMin = sessionTracker.getInactiveMinutes(chatId);
        const hadHistory = agent.getHistory().length > 0;
        console.log(
          pc.yellow(
            `[Telegram] 🕒 Sessão do chat ${chatId} expirada após ${inactiveMin}min de inatividade (limite: ${sessionTracker.getTimeoutMinutes()}min). Resetando histórico...`
          )
        );
        agent.clearHistory();
        if (hadHistory) {
          await ctx
            .reply(
              "🕒 *Sessão anterior encerrada por inatividade.* O histórico recente foi resetado para iniciar uma conversa com contexto limpo.",
              { parse_mode: "Markdown" }
            )
            .catch(() => {});
        }
      }
      sessionTracker.updateActivity(chatId);

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
      let lastSentText = "⏳ Benito está pensando...";
      let editPending = false;
      let editTimer: NodeJS.Timeout | null = null;
      let isEditing = false;
      let messageDelivered = false;

      const EDIT_THROTTLE_MS = 2500;

      const performEdit = async (isFinal = false) => {
        if (!placeholderMsg || messageDelivered) return;

        // Se o chat estiver em cooldown por 429, não tenta editar
        if (rateLimiter.isRateLimited(chatId)) {
          return;
        }

        // Se já houver uma chamada editMessageText em voo, sinaliza pendência e aguarda
        if (isEditing) {
          editPending = true;
          return;
        }

        let contentToDisplay = accumulatedTokens.trim();
        if (activeToolStatus && !contentToDisplay) {
          contentToDisplay = activeToolStatus;
        } else if (activeToolStatus && contentToDisplay) {
          contentToDisplay = `${contentToDisplay}\n\n_${activeToolStatus}_`;
        }

        if (!contentToDisplay) {
          contentToDisplay = "⏳ Benito está pensando...";
        }

        // Se o conteúdo a ser exibido for exatamente idêntico ao já enviado, evita chamada redundante à API
        if (contentToDisplay === lastSentText) {
          return;
        }

        // Garante que o texto parcial não estoure o limite de 4000 caracteres
        if (contentToDisplay.length > 4000) {
          contentToDisplay = contentToDisplay.slice(0, 3950) + "\n... [continua]";
        }

        isEditing = true;
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
            } catch (mdErr: any) {
              const retryAfter = parseTelegramRetryAfter(mdErr);
              if (retryAfter) {
                rateLimiter.setChatCooldown(chatId, retryAfter);
                console.warn(
                  pc.yellow(
                    `[Telegram] ⚠️ Rate limit (429) detectado no chat ${chatId}. Pausando edições por ${retryAfter}s.`
                  )
                );
                return;
              }
              const mdMsg = mdErr?.message || "";
              if (mdMsg.includes("message is not modified")) {
                lastSentText = contentToDisplay;
                return;
              }
              await ctx.api.editMessageText(
                chatId,
                placeholderMsg.message_id,
                contentToDisplay
              );
            }
          }
          lastSentText = contentToDisplay;
          lastEditTime = Date.now();
        } catch (editErr: any) {
          const retryAfter = parseTelegramRetryAfter(editErr);
          if (retryAfter) {
            rateLimiter.setChatCooldown(chatId, retryAfter);
            console.warn(
              pc.yellow(
                `[Telegram] ⚠️ Rate limit (429) detectado no chat ${chatId}. Pausando edições por ${retryAfter}s.`
              )
            );
            return;
          }

          const errMsg = editErr?.message || "";
          if (errMsg.includes("message is not modified")) {
            lastSentText = contentToDisplay;
            return;
          }
          // Fallback para edição sem markdown
          try {
            await ctx.api.editMessageText(
              chatId,
              placeholderMsg.message_id,
              contentToDisplay
            );
            lastSentText = contentToDisplay;
            lastEditTime = Date.now();
          } catch (fallbackErr: any) {
            const fbRetry = parseTelegramRetryAfter(fallbackErr);
            if (fbRetry) {
              rateLimiter.setChatCooldown(chatId, fbRetry);
              return;
            }
            const fbMsg = fallbackErr?.message || "";
            if (fbMsg.includes("message is not modified")) {
              lastSentText = contentToDisplay;
            }
          }
        } finally {
          isEditing = false;
          if (editPending && !isFinal && !messageDelivered && !rateLimiter.isRateLimited(chatId)) {
            editPending = false;
            scheduleEdit(false);
          }
        }
      };

      const scheduleEdit = (force = false) => {
        if (messageDelivered || rateLimiter.isRateLimited(chatId)) return;

        const elapsed = Date.now() - lastEditTime;
        if ((force || elapsed >= EDIT_THROTTLE_MS) && !isEditing) {
          if (editTimer) {
            clearTimeout(editTimer);
            editTimer = null;
          }
          editPending = false;
          performEdit(false);
        } else if (!editPending) {
          editPending = true;
          const delay = Math.max(0, EDIT_THROTTLE_MS - elapsed);
          editTimer = setTimeout(() => {
            editPending = false;
            performEdit(false);
          }, delay);
        }
      };

      try {
        console.log(pc.cyan(`\n[Telegram] Mensagem recebida: "${userInput}"`));

        let pdfCompanyTriggered = "";
        const finalResult = await agent.ask(userInput, {
          onThoughtToken: (_thoughtChunk) => {
            // Silencia os tokens de monólogo interno no chat do Telegram,
            // mantendo o placeholder '⏳ Benito está pensando...' ativo sem poluir a interface
          },
          onToken: (chunk) => {
            accumulatedTokens += chunk;
            scheduleEdit(false);
          },
          onToolCall: (toolName, args) => {
            if (toolName === "generate_tailored_application" || toolName === "export_resume_pdf") pdfCompanyTriggered = String((args as any)?.company || (args as any)?.jobId || "recent");
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

        let firstChunkDelivered = false;

        // Se o chat NÃO estiver em cooldown e temos placeholder, tenta editar a mensagem inicial com chunks[0]
        if (placeholderMsg && chunks.length > 0 && !rateLimiter.isRateLimited(chatId)) {
          if (chunks[0] === lastSentText) {
            firstChunkDelivered = true;
          } else {
            try {
              await ctx.api.editMessageText(
                chatId,
                placeholderMsg.message_id,
                chunks[0],
                { parse_mode: "Markdown" }
              );
              firstChunkDelivered = true;
              lastSentText = chunks[0];
            } catch (finalMdErr: any) {
              const retryAfter = parseTelegramRetryAfter(finalMdErr);
              if (retryAfter) {
                rateLimiter.setChatCooldown(chatId, retryAfter);
                console.warn(
                  pc.yellow(
                    `[Telegram] ⚠️ Rate limit (429) ao finalizar edição no chat ${chatId}. Ativando fallback para nova mensagem.`
                  )
                );
              } else {
                const mdMsg = finalMdErr?.message || "";
                if (mdMsg.includes("message is not modified")) {
                  firstChunkDelivered = true;
                  lastSentText = chunks[0];
                } else {
                  try {
                    await ctx.api.editMessageText(
                      chatId,
                      placeholderMsg.message_id,
                      chunks[0]
                    );
                    firstChunkDelivered = true;
                    lastSentText = chunks[0];
                  } catch (plainErr: any) {
                    const plainRetry = parseTelegramRetryAfter(plainErr);
                    if (plainRetry) {
                      rateLimiter.setChatCooldown(chatId, plainRetry);
                    }
                    const plainMsg = plainErr?.message || "";
                    if (plainMsg.includes("message is not modified")) {
                      firstChunkDelivered = true;
                      lastSentText = chunks[0];
                    }
                  }
                }
              }
            }
          }
        }

        // Se a primeira parte não pôde ser entregue por edição (429 ou erro), envia como nova mensagem!
        if (!firstChunkDelivered && chunks.length > 0) {
          console.log(
            pc.cyan(
              `[Telegram] Entregando resposta como nova mensagem (fallback de rate limit/edição)...`
            )
          );
          if (placeholderMsg) {
            ctx.api.deleteMessage(chatId, placeholderMsg.message_id).catch(() => {});
          }
          await safeReply(ctx, chunks[0], { parse_mode: "Markdown" });
          firstChunkDelivered = true;
        }

        messageDelivered = true;

        // Se houver mais de uma parte (>4000 caracteres), envia as restantes em novas mensagens
        for (let i = 1; i < chunks.length; i++) {
          await safeReply(ctx, chunks[i], { parse_mode: "Markdown" });
        }

        if (pdfCompanyTriggered) {
          try {
            const jobs = await loadAnalyzedJobs(config.obsidian.vaultPath, config.filesystem.allowedPaths);
            const matched = jobs.find((j) => j.company.toLowerCase().includes(pdfCompanyTriggered.toLowerCase()) || j.id === pdfCompanyTriggered) || jobs[jobs.length - 1];
            if (matched?.cvPdfPath && fsSync.existsSync(matched.cvPdfPath)) {
              await ctx.replyWithDocument(new InputFile(matched.cvPdfPath), {
                caption: `📄 Currículo em PDF pronto para upload ATS (${path.basename(matched.cvPdfPath)})`,
              });
            }
          } catch (pdfSendErr) {
            console.error(pc.yellow("[Telegram] Aviso ao anexar PDF do currículo:"), pdfSendErr);
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
  const ttlLog =
    config.telegram.sessionTimeoutMinutes > 0
      ? `${config.telegram.sessionTimeoutMinutes} min`
      : "Desativado";
  console.log(pc.gray(`• TTL de Inatividade:  `) + pc.blue(ttlLog));
  const digestLog = config.automation.digestEnabled
    ? `${config.automation.digestCronSchedule} (${config.automation.digestTopics.length} tópicos)`
    : "Desativado";
  console.log(pc.gray(`• Daily News Digest:   `) + (config.automation.digestEnabled ? pc.green(digestLog) : pc.red(digestLog)));
  console.log(pc.gray("--------------------------------------------------"));
  console.log(pc.green("✔ Bot do Benito conectado ao Telegram com sucesso!"));
  console.log(pc.dim("Aguardando mensagens via Long Polling... (Pressione Ctrl+C para encerrar)\n"));

  // Tratamento de encerramento gracioso
  const stopHandler = () => {
    console.log(pc.yellow("\nEncerrando conexão com o Telegram e rotinas agendadas..."));
    scheduler.stopAll();
    bot.stop();
    process.exit(0);
  };

  if (options.handleSignals !== false) process.once("SIGINT", stopHandler);
  if (options.handleSignals !== false) process.once("SIGTERM", stopHandler);

  // Inicia o bot via Long Polling
  const stopResources = () => { scheduler.stopAll(); try { bot.stop(); } catch {} };
  const pollingPromise = bot.start();
  if (!options.background) await pollingPromise;
  return { stop: stopResources, promise: pollingPromise };
}

const isTelegramDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("interfaces/telegram.ts") || process.argv[1]?.replace(/\\/g, "/").endsWith("interfaces/telegram.js");
if (isTelegramDirectRun) startTelegramBot().catch((err) => {
  console.error(pc.red("Falha crítica ao iniciar o Telegram Bot:"), err);
  process.exit(1);
});
