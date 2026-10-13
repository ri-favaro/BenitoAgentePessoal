import assert from "node:assert/strict";
import pc from "picocolors";
import {
  TaskScheduler,
  createAutomationScheduler,
  generateNewsDigest,
  executeDailyNewsDigest,
} from "../src/automation/index.js";

async function runAutomationTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTES DO SISTEMA DE AUTOMAÇÕES & DAILY NEWS DIGEST ===\n")));

  // ==========================================
  // 1. Testando TaskScheduler - Validação e Registro
  // ==========================================
  console.log(pc.yellow("1. Testando registro e validação de expressões cron no TaskScheduler..."));
  const scheduler = new TaskScheduler();

  const invalidRegistered = scheduler.registerJob({
    id: "invalid-cron-job",
    name: "Job Inválido",
    cronExpression: "expressao_invalida_nao_cron",
    enabled: true,
    handler: async () => {},
  });
  assert.strictEqual(invalidRegistered, false, "Cron inválido deve retornar false");

  let executedCount = 0;
  const validRegistered = scheduler.registerJob({
    id: "test-job-1",
    name: "Job de Teste Válido",
    cronExpression: "0 8 * * *",
    enabled: true,
    handler: async () => {
      executedCount++;
    },
  });
  assert.strictEqual(validRegistered, true, "Cron válido deve retornar true");
  assert.strictEqual(scheduler.hasJob("test-job-1"), true);

  const jobs = scheduler.getJobs();
  assert.strictEqual(jobs.length, 1);
  assert.strictEqual(jobs[0].id, "test-job-1");
  assert.strictEqual(jobs[0].isRunning, false);
  console.log(pc.green("✔ Validação e registro de jobs validados com sucesso!"));

  // ==========================================
  // 2. Testando Execução Direta e Atualização de Estado
  // ==========================================
  console.log(pc.yellow("\n2. Testando execução direta de job (runJob) e métricas de estado..."));
  const ran = await scheduler.runJob("test-job-1");
  assert.strictEqual(ran, true);
  assert.strictEqual(executedCount, 1);

  const updatedJob = scheduler.getJobs().find((j) => j.id === "test-job-1");
  assert.ok(updatedJob?.lastRunAt, "lastRunAt deve ser preenchido");
  assert.strictEqual(updatedJob?.lastStatus, "success");
  assert.strictEqual(updatedJob?.isRunning, false);
  console.log(pc.green("✔ Execução direta e persistência de métricas de estado validadas!"));

  // ==========================================
  // 3. Testando Prevenção de Concorrência (Anti-Overlap)
  // ==========================================
  console.log(pc.yellow("\n3. Testando trava de concorrência anti-sobreposição (isRunning)..."));
  let resolveSlowHandler: () => void;
  const slowPromise = new Promise<void>((resolve) => {
    resolveSlowHandler = resolve;
  });

  scheduler.registerJob({
    id: "slow-job",
    name: "Job Lento",
    cronExpression: "* * * * *",
    enabled: true,
    handler: async () => {
      await slowPromise;
    },
  });

  // Dispara a primeira execução (não espera terminar)
  const firstExecutionPromise = scheduler.runJob("slow-job");

  // Imediatamente tenta disparar uma segunda execução concorrente do mesmo job
  const secondRan = await scheduler.runJob("slow-job");
  assert.strictEqual(secondRan, false, "Segunda execução simultânea deve ser rejeitada pela trava");

  const slowState = scheduler.getJobs().find((j) => j.id === "slow-job");
  assert.strictEqual(slowState?.lastStatus, "skipped");

  // Libera o primeiro job
  resolveSlowHandler!();
  await firstExecutionPromise;
  assert.strictEqual(slowState?.isRunning, false);
  console.log(pc.green("✔ Trava anti-sobreposição preveniu execução concorrente duplicada com sucesso!"));

  // ==========================================
  // 4. Testando Ciclo de Vida do Agendador (startJob / stopAll)
  // ==========================================
  console.log(pc.yellow("\n4. Testando ciclo de vida do TaskScheduler (startJob / stopAll)..."));
  const started = scheduler.startJob("test-job-1");
  assert.strictEqual(started, true);

  scheduler.stopAll();
  const stoppedJobs = scheduler.getJobs();
  assert.strictEqual(stoppedJobs.every((j) => !j.enabled), true);
  console.log(pc.green("✔ Parada graciosa de todas as tarefas validada com sucesso!"));

  // ==========================================
  // 5. Testando createAutomationScheduler Padrão
  // ==========================================
  console.log(pc.yellow("\n5. Testando criação do TaskScheduler padrão do sistema..."));
  const defaultScheduler = createAutomationScheduler();
  assert.ok(defaultScheduler instanceof TaskScheduler);
  assert.strictEqual(defaultScheduler.hasJob("daily-news-digest"), true);
  console.log(pc.green("✔ createAutomationScheduler inicializado com job daily-news-digest!"));

  // ==========================================
  // 6. Testando generateNewsDigest com Mock de Busca e Síntese
  // ==========================================
  console.log(pc.yellow("\n6. Testando generateNewsDigest com busca mockada e tratamento de tópicos..."));

  const emptyResult = await generateNewsDigest({ topics: [] });
  assert.strictEqual(emptyResult.success, false);
  assert.strictEqual(emptyResult.topicsProcessed, 0);

  const mockSearchResults: Record<string, string> = {
    "Inteligência Artificial":
      "1. [Novo Modelo Local Qwen 3.5](https://exemplo.com/qwen) - Lançada versão com inferência otimizada.\n2. [Meta lança Llama](https://exemplo.com/llama) - Pesquisadores anunciam novos pesos.",
    "TypeScript":
      "1. [TypeScript 5.8 Anunciado](https://exemplo.com/ts) - Novas melhorias de checagem e desempenho.",
  };

  const mockModel = {
    specificationVersion: "v1",
    provider: "mock",
    modelId: "mock-model",
    defaultObjectGenerationMode: "json",
    doGenerate: async () => ({
      text: "🤖 **Daily News Digest - Segunda-feira**\n\n• **Inteligência Artificial:** [Novo Modelo Qwen](https://exemplo.com/qwen) lançado com alta performance.\n• **TypeScript:** [TypeScript 5.8](https://exemplo.com/ts) anunciado com melhorias.",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20 },
      rawCall: { rawPrompt: "", rawSettings: {} },
    }),
    doStream: async () => {
      throw new Error("not implemented");
    },
  } as any;

  const digestResult = await generateNewsDigest({
    topics: ["Inteligência Artificial", "TypeScript"],
    customModel: mockModel,
    customSearchTool: async (topic: string) => {
      const summary = mockSearchResults[topic];
      if (summary) {
        return { success: true, summary };
      }
      return { success: false, error: "Nenhum resultado" };
    },
  });

  assert.strictEqual(digestResult.topicsProcessed, 2);
  assert.strictEqual(digestResult.topicResults.length, 2);
  assert.strictEqual(digestResult.topicResults[0].found, true);
  assert.strictEqual(digestResult.topicResults[1].found, true);
  assert.ok(digestResult.digest.length > 50, "Digest deve conter texto formatado");
  console.log(pc.green("✔ generateNewsDigest gerou resumo executivo com sucesso!"));
  console.log(pc.dim(`  Prévia do digest gerado: "${digestResult.digest.slice(0, 120)}..."\n`));

  // ==========================================
  // 7. Testando executeDailyNewsDigest com Mock de Envio para Telegram
  // ==========================================
  console.log(pc.yellow("7. Testando executeDailyNewsDigest e distribuição mockada via Telegram..."));

  const sentMessages: Array<{ chatId: number; text: string; parseMode?: string }> = [];
  const mockBot = {
    api: {
      sendMessage: async (chatId: number, text: string, other?: any) => {
        sentMessages.push({ chatId, text, parseMode: other?.parse_mode });
        return { message_id: 12345 };
      },
    },
  } as any;

  const execResult = await executeDailyNewsDigest({
    topics: ["Inteligência Artificial"],
    customModel: mockModel,
    customSearchTool: async () => ({
      success: true,
      summary: "1. [Notícia de Teste](https://exemplo.com/noticia) - Detalhe importante do teste.",
    }),
    bot: mockBot,
    chatIds: [111222, 333444],
    sendTelegram: true,
  });

  assert.strictEqual(execResult.sentChats.length, 2);
  assert.ok(execResult.sentChats.includes(111222));
  assert.ok(execResult.sentChats.includes(333444));
  assert.strictEqual(sentMessages.length, 2);
  console.log(pc.green("✔ executeDailyNewsDigest disparou mensagens para os chats configurados com sucesso!"));

  // ==========================================
  // 8. Testando Resiliência de Envio (Fallback para Texto Puro)
  // ==========================================
  console.log(pc.yellow("\n8. Testando resiliência quando o Telegram rejeita Markdown com caracteres especiais..."));
  let markdownFailed = false;
  let fallbackSucceeded = false;

  const mockFailingBot = {
    api: {
      sendMessage: async (_chatId: number, _text: string, other?: any) => {
        if (other?.parse_mode === "Markdown") {
          markdownFailed = true;
          throw new Error("Bad Request: can't parse entities");
        }
        fallbackSucceeded = true;
        return { message_id: 67890 };
      },
    },
  } as any;

  const fallbackExec = await executeDailyNewsDigest({
    topics: ["TypeScript"],
    customModel: mockModel,
    customSearchTool: async () => ({ success: true, summary: "Notícia com caracteres especiais _*[ ]" }),
    bot: mockFailingBot,
    chatIds: [999888],
    sendTelegram: true,
  });

  assert.strictEqual(markdownFailed, true, "Tentativa inicial com Markdown deve ter falhado");
  assert.strictEqual(fallbackSucceeded, true, "Tentativa secundária em texto puro deve ter tido sucesso");
  assert.strictEqual(fallbackExec.sentChats.length, 1);
  console.log(pc.green("✔ Fallback resiliente para texto puro em erro de Markdown validado com sucesso!"));

  // ==========================================
  // 9. Testando Execução no Modo CLI (sendTelegram: false)
  // ==========================================
  console.log(pc.yellow("\n9. Testando executeDailyNewsDigest em modo local/CLI (sendTelegram: false)..."));
  const cliExec = await executeDailyNewsDigest({
    topics: ["Inteligência Artificial"],
    customModel: mockModel,
    customSearchTool: async () => ({ success: true, summary: "Resumo local para terminal." }),
    sendTelegram: false,
  });

  assert.strictEqual(cliExec.sentChats.length, 0);
  assert.ok(cliExec.digest.length > 0);
  console.log(pc.green("✔ Modo local/CLI executou perfeitamente sem tentar disparar rede Telegram!"));

  console.log(pc.bold(pc.green("\n🎉 Todos os 9 testes de Automações & Daily News Digest passaram com 100% de sucesso! 🚀\n")));
}

runAutomationTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste de automações:"), err);
  process.exit(1);
});
