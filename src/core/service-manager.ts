import { spawn, execFile, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import pc from "picocolors";
import { config, type AppConfig } from "../config.js";

const execFileAsync = promisify(execFile);

export type LaunchMode = "cli" | "telegram" | "cron" | "all";

export interface ServiceStatusReport {
  ollama: {
    needed: boolean;
    ready: boolean;
    startedByLauncher: boolean;
    endpoint: string;
    model: string;
    error?: string;
  };
  embedding: {
    ready: boolean;
    startedByLauncher: boolean;
    endpoint: string;
    model: string;
    error?: string;
  };
  search: {
    provider: "tavily" | "searxng";
    ready: boolean;
    startedByLauncher: boolean;
    details: string;
    error?: string;
  };
}

export interface ServiceManagerDeps {
  appConfig?: AppConfig;
  rootDir?: string;
  fetchFn?: typeof fetch;
  execCommand?: (file: string, args: string[], timeoutMs?: number) => Promise<{ stdout: string; stderr: string }>;
  spawnBackground?: (command: string, args: string[], logFilePath: string) => ChildProcess;
  logger?: (msg: string) => void;
}

export function resolveOllamaRootUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "http://127.0.0.1:11434";
  }
}

export function resolveEmbeddingRootUrl(baseUrl: string): { rootUrl: string; port: number } {
  try {
    const parsed = new URL(baseUrl);
    const port = parsed.port ? Number(parsed.port) : 8085;
    return {
      rootUrl: `${parsed.protocol}//${parsed.host}`,
      port: isNaN(port) ? 8085 : port,
    };
  } catch {
    return { rootUrl: "http://127.0.0.1:8085", port: 8085 };
  }
}

export function parseLaunchModeChoice(input: string): LaunchMode | null {
  const normalized = input.trim().toLowerCase();
  if (normalized === "1" || normalized === "cli" || normalized === "terminal") {
    return "cli";
  }
  if (normalized === "2" || normalized === "telegram" || normalized === "tg" || normalized === "bot") {
    return "telegram";
  }
  if (normalized === "3" || normalized === "cron" || normalized === "automation" || normalized === "automacao") {
    return "cron";
  }
  if (normalized === "4" || normalized === "all" || normalized === "tudo" || normalized === "completo") {
    return "all";
  }
  return null;
}

export class ServiceManager {
  private readonly cfg: AppConfig;
  private readonly rootDir: string;
  private readonly logFilePath: string;
  private readonly fetchFn: typeof fetch;
  private readonly execCommand: (
    file: string,
    args: string[],
    timeoutMs?: number
  ) => Promise<{ stdout: string; stderr: string }>;
  private readonly spawnBackground: (
    command: string,
    args: string[],
    logFilePath: string
  ) => ChildProcess;
  private readonly log: (msg: string) => void;

  private spawnedProcesses: ChildProcess[] = [];
  private activeCleanupHooks: Array<() => Promise<void> | void> = [];
  private shuttingDown = false;

  constructor(deps: ServiceManagerDeps = {}) {
    this.cfg = deps.appConfig || config;
    this.rootDir = deps.rootDir || process.cwd();
    const logsDir = path.join(this.rootDir, "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, "services.log");
    this.fetchFn = deps.fetchFn || fetch;
    this.log = deps.logger || ((msg: string) => console.log(msg));

    this.execCommand =
      deps.execCommand ||
      (async (file: string, args: string[], timeoutMs = 15000) => {
        const res = await execFileAsync(file, args, {
          timeout: timeoutMs,
          windowsHide: true,
          cwd: this.rootDir,
        });
        return { stdout: String(res.stdout || ""), stderr: String(res.stderr || "") };
      });

    this.spawnBackground =
      deps.spawnBackground ||
      ((command: string, args: string[], logFile: string) => {
        const outFd = fs.openSync(logFile, "a");
        const child = spawn(command, args, {
          cwd: this.rootDir,
          detached: false,
          windowsHide: true,
          stdio: ["ignore", outFd, outFd],
        });
        child.on("exit", () => {
          try {
            fs.closeSync(outFd);
          } catch {
            // descritor ja fechado
          }
        });
        return child;
      });
  }

  public registerCleanupHook(fn: () => Promise<void> | void): void {
    this.activeCleanupHooks.push(fn);
  }

  public async isEndpointHealthy(url: string, timeoutMs = 2000): Promise<boolean> {
    try {
      const res = await this.fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async waitForEndpoint(url: string, maxWaitMs = 25000, intervalMs = 600): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      if (await this.isEndpointHealthy(url, 1500)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  /**
   * 1. Garante que o Ollama Server está online (se provider === 'ollama')
   */
  public async ensureOllama(): Promise<ServiceStatusReport["ollama"]> {
    const rootUrl = resolveOllamaRootUrl(this.cfg.ollama.baseUrl);
    const healthUrl = `${rootUrl}/api/tags`;
    const needed = this.cfg.provider === "ollama";

    if (!needed) {
      return {
        needed: false,
        ready: true,
        startedByLauncher: false,
        endpoint: rootUrl,
        model: this.cfg.ollama.model,
      };
    }

    if (await this.isEndpointHealthy(healthUrl)) {
      this.log(
        pc.green(`  ✔ Ollama Server:       `) +
          pc.white(`Online em ${rootUrl} `) +
          pc.dim(`(modelo: ${this.cfg.ollama.model})`)
      );
      return {
        needed: true,
        ready: true,
        startedByLauncher: false,
        endpoint: rootUrl,
        model: this.cfg.ollama.model,
      };
    }

    this.log(pc.yellow(`  ⏳ Ollama Server:       Iniciando 'ollama serve' em segundo plano...`));
    try {
      const child = this.spawnBackground("ollama", ["serve"], this.logFilePath);
      this.spawnedProcesses.push(child);

      const ready = await this.waitForEndpoint(healthUrl, 20000);
      if (ready) {
        this.log(
          pc.green(`  ✔ Ollama Server:       `) +
            pc.white(`Iniciado com sucesso em ${rootUrl} `) +
            pc.dim(`(modelo: ${this.cfg.ollama.model})`)
        );
        return {
          needed: true,
          ready: true,
          startedByLauncher: true,
          endpoint: rootUrl,
          model: this.cfg.ollama.model,
        };
      }

      const err = `Timeout aguardando Ollama responder em ${healthUrl}`;
      this.log(pc.red(`  ✖ Ollama Server:       ${err}`));
      return {
        needed: true,
        ready: false,
        startedByLauncher: true,
        endpoint: rootUrl,
        model: this.cfg.ollama.model,
        error: err,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(pc.red(`  ✖ Ollama Server:       Falha ao iniciar (${msg})`));
      return {
        needed: true,
        ready: false,
        startedByLauncher: false,
        endpoint: rootUrl,
        model: this.cfg.ollama.model,
        error: msg,
      };
    }
  }

  /**
   * 2. Garante que o servidor de Embeddings (llama-server na porta 8085) está online
   */
  public async ensureEmbeddingServer(): Promise<ServiceStatusReport["embedding"]> {
    const { rootUrl, port } = resolveEmbeddingRootUrl(this.cfg.embedding.baseUrl);
    const healthUrl = `${rootUrl}/health`;

    if (await this.isEndpointHealthy(healthUrl)) {
      this.log(
        pc.green(`  ✔ Embeddings (8085):   `) +
          pc.white(`Online em ${rootUrl} `) +
          pc.dim(`(${this.cfg.embedding.model})`)
      );
      return {
        ready: true,
        startedByLauncher: false,
        endpoint: rootUrl,
        model: this.cfg.embedding.model,
      };
    }

    this.log(
      pc.yellow(`  ⏳ Embeddings (${port}):   Iniciando llama-server (EmbeddingGemma-2)...`)
    );

    const modelsDir = path.join(this.rootDir, ".models");
    const binExe = path.join(modelsDir, "bin", "llama-server.exe");
    const modelFile = path.join(modelsDir, "embeddinggemma-2-Q8_0.gguf");

    try {
      let child: ChildProcess;
      if (fs.existsSync(binExe) && fs.existsSync(modelFile)) {
        // Inicia diretamente o binario llama-server com flags otimizadas (~270MB RAM)
        child = this.spawnBackground(
          binExe,
          [
            "--port",
            String(port),
            "--embedding",
            "--model",
            modelFile,
            "-np",
            "1",
            "-c",
            "2048",
            "-b",
            "512",
            "-ub",
            "512",
            "-ngl",
            "99",
            "--host",
            "127.0.0.1",
          ],
          this.logFilePath
        );
      } else {
        // Fallback para o script PowerShell que baixa automaticamente o binario/modelo se ausentes
        const psScript = path.join(this.rootDir, "scripts", "start-embedding-server.ps1");
        child = this.spawnBackground(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            psScript,
            "-Port",
            String(port),
            "-ContextSize",
            "2048",
            "-BatchSize",
            "512",
          ],
          this.logFilePath
        );
      }

      this.spawnedProcesses.push(child);

      const ready = await this.waitForEndpoint(healthUrl, 30000);
      if (ready) {
        this.log(
          pc.green(`  ✔ Embeddings (${port}):   `) +
            pc.white(`Iniciado com sucesso em ${rootUrl} `) +
            pc.dim(`(~270MB VRAM/RAM)`)
        );
        return {
          ready: true,
          startedByLauncher: true,
          endpoint: rootUrl,
          model: this.cfg.embedding.model,
        };
      }

      const err = `Timeout aguardando llama-server em ${healthUrl}. Verifique logs/services.log.`;
      this.log(pc.red(`  ✖ Embeddings (${port}):   ${err}`));
      return {
        ready: false,
        startedByLauncher: true,
        endpoint: rootUrl,
        model: this.cfg.embedding.model,
        error: err,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(pc.red(`  ✖ Embeddings (${port}):   Falha ao iniciar (${msg})`));
      return {
        ready: false,
        startedByLauncher: false,
        endpoint: rootUrl,
        model: this.cfg.embedding.model,
        error: msg,
      };
    }
  }

  /**
   * 3. Garante que o provedor de Busca Web está pronto (Tavily ou SearXNG Docker)
   */
  public async ensureSearchProvider(): Promise<ServiceStatusReport["search"]> {
    if (this.cfg.searchProvider === "tavily") {
      const hasKey = Boolean(this.cfg.tavily.apiKey && this.cfg.tavily.apiKey.trim().length > 0);
      if (hasKey) {
        this.log(
          pc.green(`  ✔ Busca Web (Tavily):  `) +
            pc.white(`API Cloud pronta `) +
            pc.dim(`(Docker SearXNG desnecessário)`)
        );
        return {
          provider: "tavily",
          ready: true,
          startedByLauncher: false,
          details: "Tavily AI Search (api.tavily.com)",
        };
      } else {
        const warn = "TAVILY_API_KEY ausente no .env";
        this.log(pc.yellow(`  ⚠ Busca Web (Tavily):  ${warn}`));
        return {
          provider: "tavily",
          ready: false,
          startedByLauncher: false,
          details: warn,
          error: warn,
        };
      }
    }

    // Caso SEARCH_PROVIDER === 'searxng'
    const searxUrl = this.cfg.searxng.baseUrl;
    if (await this.isEndpointHealthy(searxUrl)) {
      this.log(
        pc.green(`  ✔ Busca Web (SearXNG): `) + pc.white(`Container online em ${searxUrl}`)
      );
      return {
        provider: "searxng",
        ready: true,
        startedByLauncher: false,
        details: searxUrl,
      };
    }

    this.log(pc.yellow(`  ⏳ Busca Web (SearXNG): Iniciando container Docker 'searxng'...`));
    try {
      try {
        await this.execCommand("docker", ["start", "searxng"], 15000);
      } catch {
        await this.execCommand("docker", ["compose", "up", "-d", "searxng"], 30000);
      }

      const ready = await this.waitForEndpoint(searxUrl, 20000);
      if (ready) {
        this.log(
          pc.green(`  ✔ Busca Web (SearXNG): `) +
            pc.white(`Container iniciado em ${searxUrl}`)
        );
        return {
          provider: "searxng",
          ready: true,
          startedByLauncher: true,
          details: searxUrl,
        };
      }

      const err = `Container searxng não respondeu em ${searxUrl}`;
      this.log(pc.red(`  ✖ Busca Web (SearXNG): ${err}`));
      return {
        provider: "searxng",
        ready: false,
        startedByLauncher: true,
        details: searxUrl,
        error: err,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(pc.red(`  ✖ Busca Web (SearXNG): Erro no Docker (${msg})`));
      return {
        provider: "searxng",
        ready: false,
        startedByLauncher: false,
        details: searxUrl,
        error: msg,
      };
    }
  }

  /**
   * Inicia todas as dependências em sequência com feedback visual claro.
   */
  public async startAllDependencies(): Promise<ServiceStatusReport> {
    this.log(pc.cyan("\n[Inicializando Dependências do Benito]"));
    const ollama = await this.ensureOllama();
    const embedding = await this.ensureEmbeddingServer();
    const search = await this.ensureSearchProvider();

    return { ollama, embedding, search };
  }

  /**
   * Desliga absolutamente todas as dependências para liberar 100% de RAM e VRAM:
   * - Hooks ativos do Benito (Telegram Bot / Cron Scheduler)
   * - Processos filhos diretos
   * - llama-server.exe (porta 8085)
   * - Descarrega modelo da VRAM (ollama stop) e encerra ollama.exe / ollama app.exe
   * - Para o container searxng caso SEARCH_PROVIDER === 'searxng'
   */
  public async shutdownAll(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    this.log(pc.yellow("\n=================================================="));
    this.log(pc.yellow("   ENCERRANDO BENITO E TODAS AS DEPENDÊNCIAS...   "));
    this.log(pc.yellow("=================================================="));

    // 1. Encerra hooks internos (Telegram / Cron)
    for (const hook of this.activeCleanupHooks) {
      try {
        await hook();
      } catch {
        // ignora erros no shutdown
      }
    }
    this.activeCleanupHooks = [];

    // 2. Mata processos filhos rastreados diretamente
    for (const child of this.spawnedProcesses) {
      if (child.pid && !child.killed) {
        try {
          if (process.platform === "win32") {
            await this.execCommand("taskkill", ["/F", "/T", "/PID", String(child.pid)], 4000);
          } else {
            child.kill("SIGTERM");
          }
        } catch {
          // processo ja encerrado
        }
      }
    }
    this.spawnedProcesses = [];

    // 3. Garante encerramento total do llama-server.exe (Embeddings)
    if (process.platform === "win32") {
      try {
        await this.execCommand("taskkill", ["/F", "/IM", "llama-server.exe", "/T"], 4000);
        this.log(pc.green("  ✔ Embeddings (llama-server.exe) encerrado."));
      } catch {
        this.log(pc.dim("  • Embeddings (llama-server.exe) já estava parado."));
      }
    }

    // 4. Descarrega o modelo da VRAM e encerra o Ollama completamente
    if (this.cfg.provider === "ollama") {
      try {
        await this.execCommand("ollama", ["stop", this.cfg.ollama.model], 5000);
        this.log(pc.green(`  ✔ Modelo ${this.cfg.ollama.model} descarregado da VRAM.`));
      } catch {
        // pode ja estar descarregado
      }

      if (process.platform === "win32") {
        try {
          await this.execCommand("taskkill", ["/F", "/IM", "ollama app.exe", "/T"], 4000);
        } catch {
          // bandeja nao estava aberta
        }
        try {
          await this.execCommand("taskkill", ["/F", "/IM", "ollama.exe", "/T"], 4000);
          this.log(pc.green("  ✔ Servidor Ollama (ollama.exe) encerrado completamente."));
        } catch {
          this.log(pc.dim("  • Servidor Ollama já estava parado."));
        }
      }
    }

    // 5. Para o container SearXNG se estiver configurado como provedor de busca
    if (this.cfg.searchProvider === "searxng") {
      try {
        await this.execCommand("docker", ["stop", "searxng"], 8000);
        this.log(pc.green("  ✔ Container Docker 'searxng' encerrado."));
      } catch {
        this.log(pc.dim("  • Container 'searxng' já estava parado."));
      }
    }

    this.log(pc.cyan("✔ Todos os serviços foram desligados. Memória RAM/VRAM liberada!\n"));
  }
}
