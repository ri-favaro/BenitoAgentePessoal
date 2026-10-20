import assert from "node:assert/strict";
import pc from "picocolors";
import {
  ServiceManager,
  parseLaunchModeChoice,
  resolveOllamaRootUrl,
  resolveEmbeddingRootUrl,
} from "../src/core/service-manager.js";
import { config, type AppConfig } from "../src/config.js";
import type { ChildProcess } from "node:child_process";

async function runTests() {
  console.log(pc.bold(pc.cyan("\n🧪 Iniciando Suíte de Testes: Launcher & ServiceManager...\n")));

  // 1. Teste de parseLaunchModeChoice
  console.log(pc.yellow("▶ 1. Testando parseLaunchModeChoice (opções do menu)..."));
  assert.equal(parseLaunchModeChoice("1"), "cli");
  assert.equal(parseLaunchModeChoice("cli"), "cli");
  assert.equal(parseLaunchModeChoice("2"), "telegram");
  assert.equal(parseLaunchModeChoice("telegram"), "telegram");
  assert.equal(parseLaunchModeChoice("3"), "cron");
  assert.equal(parseLaunchModeChoice("cron"), "cron");
  assert.equal(parseLaunchModeChoice("4"), "all");
  assert.equal(parseLaunchModeChoice("completo"), "all");
  assert.equal(parseLaunchModeChoice("99"), null);
  console.log(pc.green("  ✔ parseLaunchModeChoice validado com sucesso!"));

  // 2. Teste de resolução de URLs base
  console.log(pc.yellow("▶ 2. Testando resolveOllamaRootUrl e resolveEmbeddingRootUrl..."));
  assert.equal(resolveOllamaRootUrl("http://localhost:11434/v1"), "http://localhost:11434");
  const emb = resolveEmbeddingRootUrl("http://localhost:8085/v1");
  assert.equal(emb.rootUrl, "http://localhost:8085");
  assert.equal(emb.port, 8085);
  console.log(pc.green("  ✔ Resolução de URLs base validada!"));

  // 3. Teste de inicialização com Tavily (não deve chamar Docker) e serviços já online
  console.log(pc.yellow("▶ 3. Testando startAllDependencies com Tavily ativo (sem acionar Docker)..."));
  const executedCommands: Array<{ file: string; args: string[] }> = [];
  const spawnedCommands: Array<{ command: string; args: string[] }> = [];

  const mockConfigTavily: AppConfig = {
    ...config,
    provider: "ollama",
    searchProvider: "tavily",
    tavily: { apiKey: "tvly-test-key-123" },
  };

  const managerTavily = new ServiceManager({
    appConfig: mockConfigTavily,
    logger: () => {},
    fetchFn: (async () => ({ ok: true } as Response)) as typeof fetch,
    execCommand: async (file, args) => {
      executedCommands.push({ file, args });
      return { stdout: "ok", stderr: "" };
    },
    spawnBackground: (command, args) => {
      spawnedCommands.push({ command, args });
      return { pid: 12345, killed: false, kill: () => true } as unknown as ChildProcess;
    },
  });

  const statusTavily = await managerTavily.startAllDependencies();
  assert.equal(statusTavily.ollama.ready, true);
  assert.equal(statusTavily.embedding.ready, true);
  assert.equal(statusTavily.search.provider, "tavily");
  assert.equal(statusTavily.search.ready, true);
  assert.equal(spawnedCommands.length, 0, "Não deve spawnar se já estiverem online");
  assert.equal(
    executedCommands.some((c) => c.file.includes("docker")),
    false,
    "Não deve tocar no Docker quando SEARCH_PROVIDER=tavily"
  );
  console.log(pc.green("  ✔ Inicialização com Tavily validada sem chamadas ao Docker!"));

  // 4. Teste de shutdownAll (garantia de encerramento de Ollama, llama-server, hooks e SearXNG quando ativo)
  console.log(pc.yellow("▶ 4. Testando shutdownAll completo (VRAM + Ollama + Embeddings + SearXNG)..."));
  const shutdownCommands: Array<{ file: string; args: string[] }> = [];
  let hookCalled = false;

  const mockConfigSearx: AppConfig = {
    ...config,
    provider: "ollama",
    ollama: { baseUrl: "http://localhost:11434/v1", model: "qwen3.5:9b-24k" },
    searchProvider: "searxng",
  };

  const managerShutdown = new ServiceManager({
    appConfig: mockConfigSearx,
    logger: () => {},
    fetchFn: (async () => ({ ok: true } as Response)) as typeof fetch,
    execCommand: async (file, args) => {
      shutdownCommands.push({ file, args });
      return { stdout: "ok", stderr: "" };
    },
  });

  managerShutdown.registerCleanupHook(() => {
    hookCalled = true;
  });

  await managerShutdown.shutdownAll();

  assert.equal(hookCalled, true, "Deve executar o cleanupHook registrado (Telegram/Cron)");
  assert.equal(
    shutdownCommands.some((c) => c.file === "ollama" && c.args[0] === "stop" && c.args[1] === "qwen3.5:9b-24k"),
    true,
    "Deve descarregar o modelo da VRAM com 'ollama stop'"
  );
  if (process.platform === "win32") {
    assert.equal(
      shutdownCommands.some((c) => c.file === "taskkill" && c.args.includes("llama-server.exe")),
      true,
      "Deve encerrar llama-server.exe"
    );
    assert.equal(
      shutdownCommands.some((c) => c.file === "taskkill" && c.args.includes("ollama.exe")),
      true,
      "Deve encerrar ollama.exe"
    );
  }
  assert.equal(
    shutdownCommands.some((c) => c.file === "docker" && c.args[0] === "stop" && c.args[1] === "searxng"),
    true,
    "Deve parar o container searxng quando SEARCH_PROVIDER=searxng"
  );
  console.log(pc.green("  ✔ Desligamento completo de dependências validado com sucesso!"));

  console.log(pc.bold(pc.green("\n✅ Todos os testes do Launcher & ServiceManager passaram!\n")));
}

runTests().catch((err) => {
  console.error(pc.red("\n❌ Falha nos testes do Launcher:"), err);
  process.exit(1);
});
