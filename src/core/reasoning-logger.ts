import fs from "node:fs/promises";
import path from "node:path";

export interface ReasoningAuditEntry {
  timestamp: string;
  userInput: string;
  thought: string;
  cleanResponse: string;
  durationMs: number;
}

export async function logReasoningAudit(
  entry: ReasoningAuditEntry,
  logFilePath?: string
): Promise<void> {
  try {
    const targetFile =
      logFilePath || path.resolve(process.cwd(), "logs", "reasoning.log");
    const targetDir = path.dirname(targetFile);

    await fs.mkdir(targetDir, { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(targetFile, line, "utf-8");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ReasoningLogger] Falha ao registrar log de auditoria: ${msg}`);
  }
}
