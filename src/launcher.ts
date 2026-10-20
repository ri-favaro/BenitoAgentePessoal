import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import {
  ServiceManager,
  parseLaunchModeChoice,
  type LaunchMode,
} from "./core/service-manager.js";
import { startCli } from "./cli.js";
import { startTelegramBot } from "./interfaces/telegram.js";
import { startAutomationService } from "./automation/index.js";

async function promptLaunchMode(): Promise<LaunchMode | "exit"> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log("\n" + pc.bold(pc.cyan("==================================================")));
    console.log(pc.bold(pc.cyan("        BENITO - CENTRAL DE INICIALIZAÇÃO         ")));
    console.log(pc.bold(pc.cyan("==================================================")));
    console.log(pc.gray("Escolha como deseja iniciar o Benito hoje:\n"));
    console.log(
      pc.bold(pc.green("  [1] ")) +
        pc.white("CLI no Terminal       ") +
        pc.dim("(Chat interativo direto nesta janela)")
    );
    console.log(
      pc.bold(pc.blue("  [2] ")) +
        pc.white("Telegram Bot          ") +
        pc.dim("(Acesso remoto no celular + Cron integrado)")
    );
    console.log(
      pc.bold(pc.yellow("  [3] ")) +
        pc.white("Apenas Cron / Jobs    ") +
        pc.dim("(Somente agendador de tarefas e Daily Digest)")
    );
    console.log(
      pc.bold(pc.magenta("  [4] ")) +
        pc.white("Modo Completo         ") +
        pc.dim("(CLI no Terminal + Telegram Bot + Cron juntos)")
    );
    console.log(pc.bold(pc.red("  [0] ")) + pc.gray("Sair"));
    console.log(pc.gray("--------------------------------------------------"));

    while (true) {
      const answer = await rl.question(pc.bold(pc.cyan("Selecione uma opção [1-4, padrão=1]: ")));
      const trimmed = answer.trim();

      if (trimmed === "0" || trimmed.toLowerCase() === "sair" || trimmed.toLowerCase() === "exit") {
        return "exit";
      }

      if (trimmed === "") {
        return "cli";
      }

      const parsed = parseLaunchModeChoice(trimmed);
      if (parsed) {
        return parsed;
      }

      console.log(pc.yellow("Opção inválida. Digite 1, 2, 3, 4 ou 0 para sair."));
    }
  } finally {
    rl.close();
  }
}

export async function runLauncher(): Promise<void> {
  const serviceManager = new ServiceManager();

  // Verifica se o modo foi passado por linha de comando (ex: npm run launcher -- telegram)
  const cliArg = process.argv.slice(2).find((arg) => !arg.startsWith("-")) || "";
  let mode: LaunchMode | "exit" | null = cliArg ? parseLaunchModeChoice(cliArg) : null;

  if (!mode) {
    try {
      mode = await promptLaunchMode();
    } catch {
      mode = "exit";
    }
  }

  if (mode === "exit") {
    console.log(pc.dim("\nInicialização cancelada.\n"));
    process.exit(0);
  }

  let exitTriggered = false;
  const gracefulExit = async (exitCode = 0) => {
    if (exitTriggered) return;
    exitTriggered = true;
    await serviceManager.shutdownAll();
    process.exit(exitCode);
  };

  // Captura Ctrl+C, kill e fechamento da janela do console no Windows (SIGHUP = CTRL_CLOSE_EVENT)
  process.on("SIGINT", () => {
    void gracefulExit(0);
  });
  process.on("SIGTERM", () => {
    void gracefulExit(0);
  });
  process.on("SIGHUP", () => {
    void gracefulExit(0);
  });

  // 1. Sobe todas as dependências (Ollama, llama-server 8085, SearXNG/Tavily)
  await serviceManager.startAllDependencies();

  // 2. Executa o modo escolhido pelo usuário
  try {
    if (mode === "cli") {
      await startCli();
      await gracefulExit(0);
    } else if (mode === "telegram") {
      const tgHandle = await startTelegramBot({ handleSignals: false, background: true });
      serviceManager.registerCleanupHook(() => tgHandle.stop());
      await tgHandle.promise;
      await gracefulExit(0);
    } else if (mode === "cron") {
      const cronHandle = await startAutomationService({ handleSignals: false });
      serviceManager.registerCleanupHook(() => cronHandle.stop());
      // Mantém processo vivo aguardando os horários do Cron até Ctrl+C ou fechar janela
      await new Promise<void>(() => {});
    } else if (mode === "all") {
      console.log(
        pc.magenta("\n[Modo Completo] Iniciando Telegram Bot + Cron em segundo plano e abrindo CLI...")
      );
      const tgHandle = await startTelegramBot({ handleSignals: false, background: true });
      serviceManager.registerCleanupHook(() => tgHandle.stop());
      await startCli();
      await gracefulExit(0);
    }
  } catch (err) {
    console.error(pc.red("\nErro durante a execução do Benito:"), err);
    await gracefulExit(1);
  }
}

const isDirectRun =
  process.argv[1]?.replace(/\\/g, "/").endsWith("src/launcher.ts") ||
  process.argv[1]?.replace(/\\/g, "/").endsWith("dist/launcher.js");

if (isDirectRun) {
  runLauncher().catch((err) => {
    console.error(pc.red("Falha crítica no Launcher do Benito:"), err);
    process.exit(1);
  });
}
