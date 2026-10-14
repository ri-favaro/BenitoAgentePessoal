import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { validateAllowedPath } from "../tools/path-guard.js";

const execFileAsync = promisify(execFile);

export interface TerminalExecutionOptions {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface TerminalExecutionResult {
  success: boolean;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

/**
 * Runner seguro para execução de comandos de console no workspace.
 * Aplica whitelist estrita de executáveis e sandbox de diretórios autorizados.
 */
export class TerminalRunner {
  private allowedPaths: string[];
  private allowedCommands: Set<string>;
  private defaultTimeoutMs: number;
  private projectRoot: string;

  constructor(options?: {
    allowedPaths?: string[];
    allowedCommands?: string[];
    timeoutMs?: number;
    projectRoot?: string;
  }) {
    this.allowedPaths = options?.allowedPaths || config.filesystem.allowedPaths;
    const rawAllowedCommands =
      options?.allowedCommands || config.orchestration.allowedCommands;
    this.allowedCommands = new Set(
      rawAllowedCommands.map((c) => c.toLowerCase().trim()).filter(Boolean)
    );
    this.defaultTimeoutMs =
      options?.timeoutMs || config.orchestration.timeoutMs;
    this.projectRoot = options?.projectRoot || process.cwd();
  }

  /**
   * Extrai o nome canônico do executável (sem extensão e em minúsculas).
   */
  getCanonicalCommand(command: string): string {
    const base = path.basename(command.trim());
    return base.replace(/\.(exe|cmd|bat)$/i, "").toLowerCase();
  }

  /**
   * Verifica se o comando informado pertence à whitelist permitida.
   */
  isCommandAllowed(command: string): boolean {
    const canonical = this.getCanonicalCommand(command);
    return this.allowedCommands.has(canonical);
  }

  /**
   * Executa um comando no workspace com validações de sandbox, whitelist e timeout.
   */
  async execute(options: TerminalExecutionOptions): Promise<TerminalExecutionResult> {
    const startTime = Date.now();
    const rawCommand = options.command.trim();
    const args = options.args || [];
    const targetCwd = options.cwd ? path.resolve(options.cwd) : this.projectRoot;
    const timeout = options.timeoutMs || this.defaultTimeoutMs;

    // 1. Validação de Sandbox do diretório de trabalho
    const pathValidation = validateAllowedPath(targetCwd, this.allowedPaths);
    if (!pathValidation.allowed) {
      return {
        success: false,
        command: rawCommand,
        args,
        cwd: targetCwd,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - startTime,
        error: pathValidation.error || "Diretório de trabalho não autorizado.",
      };
    }

    // 2. Validação de Whitelist do binário
    if (!this.isCommandAllowed(rawCommand)) {
      const allowedList = Array.from(this.allowedCommands).join(", ");
      return {
        success: false,
        command: rawCommand,
        args,
        cwd: targetCwd,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - startTime,
        error: `Comando '${rawCommand}' não permitido pela política de segurança. Comandos autorizados: [${allowedList}]`,
      };
    }

    // 3. Preparação do executável para ambientes Windows / Posix
    const isWindows = process.platform === "win32";
    const canonicalCmd = this.getCanonicalCommand(rawCommand);

    let binToRun = rawCommand;
    let finalArgs = args;

    // No Windows, scripts batch como npm e npx rodam via cmd.exe para evitar EINVAL
    if (isWindows && (canonicalCmd === "npm" || canonicalCmd === "npx")) {
      binToRun = process.env.ComSpec || "cmd.exe";
      finalArgs = ["/d", "/s", "/c", canonicalCmd, ...args];
    } else if (canonicalCmd === "agy" && config.orchestration.agyBinPath) {
      binToRun = config.orchestration.agyBinPath;
    }

    // 4. Execução do comando com limites de buffer e timeout
    const maxBuffer = 10 * 1024 * 1024; // 10MB
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const { stdout, stderr } = await execFileAsync(binToRun, finalArgs, {
        cwd: targetCwd,
        windowsHide: true,
        maxBuffer,
        signal: abortController.signal,
        env: {
          ...process.env,
          ...(options.env || {}),
        },
      });

      clearTimeout(timeoutTimer);

      return {
        success: true,
        command: rawCommand,
        args,
        cwd: targetCwd,
        exitCode: 0,
        stdout: (stdout || "").trim(),
        stderr: (stderr || "").trim(),
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      clearTimeout(timeoutTimer);

      const isAborted = abortController.signal.aborted || err?.name === "AbortError";
      const exitCode = typeof err?.code === "number" ? err.code : null;
      const stdout = (err?.stdout || "").trim();
      const stderr = (err?.stderr || "").trim();

      let errorMessage = err?.message || String(err);
      if (isAborted) {
        errorMessage = `Execução cancelada por tempo limite (timeout de ${timeout}ms excedido).`;
      }

      return {
        success: false,
        command: rawCommand,
        args,
        cwd: targetCwd,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }
}
