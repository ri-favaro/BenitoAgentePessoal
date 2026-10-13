import pc from "picocolors";
import { config } from "../config.js";
import { TaskScheduler } from "./scheduler.js";
import { executeDailyNewsDigest, generateNewsDigest } from "./jobs/daily-news-digest.js";
import type { Bot } from "grammy";

export { TaskScheduler } from "./scheduler.js";
export {
  executeDailyNewsDigest,
  generateNewsDigest,
  type DailyNewsDigestResult,
  type GenerateDigestOptions,
  type ExecuteDigestOptions,
} from "./jobs/daily-news-digest.js";

/**
 * Cria e configura o TaskScheduler padrão com os jobs habilitados no sistema.
 */
export function createAutomationScheduler(bot?: Bot): TaskScheduler {
  const scheduler = new TaskScheduler();

  if (config.automation.digestEnabled) {
    scheduler.registerJob({
      id: "daily-news-digest",
      name: "Daily News Digest no Telegram",
      cronExpression: config.automation.digestCronSchedule,
      enabled: true,
      handler: async () => {
        console.log(pc.cyan("\n[Automação] Disparando Daily News Digest programado..."));
        const result = await executeDailyNewsDigest({
          bot,
          chatIds: config.telegram.allowedUserIds,
          sendTelegram: true,
        });
        if (result.success) {
          console.log(
            pc.green(
              `[Automação] Daily News Digest enviado com sucesso para ${result.sentChats.length} chat(s).`
            )
          );
        } else {
          console.error(pc.red(`[Automação] Erro no Daily News Digest: ${result.error}`));
        }
      },
    });
  }

  return scheduler;
}

/**
 * Ponto de entrada para execução standalone (npm run automation)
 */
async function main() {
  console.log("\n" + pc.bold(pc.cyan("==================================================")));
  console.log(pc.bold(pc.cyan("       BENITO - MOTOR DE AUTOMAÇÕES & JOBS        ")));
  console.log(pc.bold(pc.cyan("==================================================")));
  console.log(pc.gray(`• Status do Digest:    `) + (config.automation.digestEnabled ? pc.green("Habilitado") : pc.red("Desabilitado")));
  console.log(pc.gray(`• Expressão Cron:      `) + pc.yellow(config.automation.digestCronSchedule));
  console.log(pc.gray(`• Tópicos de Notícias: `) + pc.blue(config.automation.digestTopics.join(", ")));
  console.log(
    pc.gray(`• Destinatários (TG):  `) +
      (config.telegram.allowedUserIds.length > 0
        ? pc.green(config.telegram.allowedUserIds.join(", "))
        : pc.yellow("Nenhum chat configurado no .env"))
  );
  console.log(pc.gray("--------------------------------------------------"));

  const scheduler = createAutomationScheduler();
  scheduler.startAll();

  console.log(pc.green("✔ Agendador ativo e aguardando horários programados..."));
  console.log(pc.dim("Pressione Ctrl+C para encerrar o serviço de automações.\n"));

  const stop = () => {
    console.log(pc.yellow("\nEncerrando motor de automações..."));
    scheduler.stopAll();
    process.exit(0);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

// Se executado diretamente pelo Node/tsx
if (process.argv[1]?.endsWith("automation/index.ts") || process.argv[1]?.endsWith("automation/index.js")) {
  main().catch((err) => {
    console.error(pc.red("Erro crítico no motor de automações:"), err);
    process.exit(1);
  });
}
