import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ReasoningAuditEntry } from "./reasoning-logger.js";

const execFileAsync = promisify(execFile);

export interface LogAuditMetric {
  totalTurns: number;
  avgDurationMs: number;
  slowTurnsCount: number;
  slowTurns: {
    timestamp: string;
    userInput: string;
    durationMs: number;
  }[];
}

export interface SandboxComplianceViolation {
  file: string;
  toolName?: string;
  issue: string;
}

export interface TestGap {
  sourceModule: string;
  missingTestFile: string;
}

export interface FullAuditReport {
  timestamp: string;
  performance: LogAuditMetric;
  sandboxViolations: SandboxComplianceViolation[];
  testGaps: TestGap[];
}

export interface IssueProposal {
  title: string;
  body: string;
  labels: string[];
}

export class SelfAuditor {
  private projectRoot: string;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || process.cwd();
  }

  /**
   * Analisa o arquivo logs/reasoning.log para identificar gargalos de latência.
   */
  async analyzeReasoningLogs(customLogPath?: string): Promise<LogAuditMetric> {
    const logFile =
      customLogPath || path.resolve(this.projectRoot, "logs", "reasoning.log");

    try {
      const content = await fs.readFile(logFile, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      const entries: ReasoningAuditEntry[] = [];

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Linha corrompida ignorada
        }
      }

      if (entries.length === 0) {
        return { totalTurns: 0, avgDurationMs: 0, slowTurnsCount: 0, slowTurns: [] };
      }

      const totalDuration = entries.reduce((acc, e) => acc + (e.durationMs || 0), 0);
      const avgDurationMs = Math.round(totalDuration / entries.length);
      const slowTurns = entries
        .filter((e) => (e.durationMs || 0) > 15000)
        .map((e) => ({
          timestamp: e.timestamp,
          userInput: e.userInput?.slice(0, 80) || "",
          durationMs: e.durationMs,
        }));

      return {
        totalTurns: entries.length,
        avgDurationMs,
        slowTurnsCount: slowTurns.length,
        slowTurns,
      };
    } catch {
      // Se o log não existir ainda, retorna métricas zeradas
      return { totalTurns: 0, avgDurationMs: 0, slowTurnsCount: 0, slowTurns: [] };
    }
  }

  /**
   * Checa se os módulos de ferramentas em src/tools/ cumprem as diretrizes do AGENTS.md
   * (uso obrigatório do path-guard em ferramentas de I/O em disco).
   */
  async auditSandboxCompliance(): Promise<SandboxComplianceViolation[]> {
    const toolsDir = path.resolve(this.projectRoot, "src", "tools");
    const violations: SandboxComplianceViolation[] = [];

    try {
      const files = await fs.readdir(toolsDir);
      for (const file of files) {
        if (!file.endsWith(".ts") || file === "index.ts" || file === "path-guard.ts") {
          continue;
        }

        const filePath = path.join(toolsDir, file);
        const code = await fs.readFile(filePath, "utf-8");

        // Se o arquivo manipula o sistema de arquivos (fs/promises ou fs)
        const hasFsUsage =
          code.includes('from "node:fs') ||
          code.includes("from 'node:fs") ||
          code.includes('require("node:fs') ||
          code.includes("fs.");

        if (hasFsUsage) {
          const hasPathGuardImport =
            code.includes("path-guard.js") || code.includes("path-guard");
          const hasValidateCall =
            code.includes("validateAllowedPath") || code.includes("isPathInside");

          if (!hasPathGuardImport || !hasValidateCall) {
            violations.push({
              file: `src/tools/${file}`,
              issue:
                "Módulo realiza operações no filesystem sem importar ou invocar a validação de sandbox (validateAllowedPath / isPathInside) do path-guard.",
            });
          }
        }
      }
    } catch {
      // Falha ao ler pasta src/tools
    }

    return violations;
  }

  /**
   * Cruza a implementação de src/ com a suíte de testes em tests/.
   */
  async auditTestCoverage(): Promise<TestGap[]> {
    const testsDir = path.resolve(this.projectRoot, "tests");
    const gaps: TestGap[] = [];

    try {
      const testFiles = await fs.readdir(testsDir);
      const testNames = new Set(testFiles.map((f) => f.toLowerCase()));

      const checkModule = async (subDir: string) => {
        const dirPath = path.resolve(this.projectRoot, "src", subDir);
        try {
          const files = await fs.readdir(dirPath);
          for (const file of files) {
            if (!file.endsWith(".ts") || file === "index.ts") continue;
            const baseName = file.replace(".ts", "").toLowerCase();
            
            // Procura testes como test-nome.ts ou test-nome-algo.ts
            const hasTest = Array.from(testNames).some(
              (tf) => tf.includes(baseName) || baseName.includes(tf.replace("test-", "").replace(".ts", ""))
            );

            if (!hasTest) {
              gaps.push({
                sourceModule: `src/${subDir}/${file}`,
                missingTestFile: `tests/test-${file.replace(".ts", "")}.ts`,
              });
            }
          }
        } catch {
          // Diretório pode não existir
        }
      };

      await checkModule("tools");
      await checkModule("core");
    } catch {
      // tests dir não encontrado
    }

    return gaps;
  }

  /**
   * Executa a auditoria completa do agente.
   */
  async runAudit(): Promise<FullAuditReport> {
    const [performance, sandboxViolations, testGaps] = await Promise.all([
      this.analyzeReasoningLogs(),
      this.auditSandboxCompliance(),
      this.auditTestCoverage(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      performance,
      sandboxViolations,
      testGaps,
    };
  }

  /**
   * Gera uma minuta técnica de issue em Markdown baseada no relatório da auditoria.
   */
  generateIssueProposal(report: FullAuditReport): IssueProposal | null {
    const hasIssues =
      report.sandboxViolations.length > 0 ||
      report.testGaps.length > 0 ||
      report.performance.slowTurnsCount > 0;

    if (!hasIssues) {
      return null;
    }

    let title = "chore(audit): melhorias de qualidade, cobertura de testes e sandbox";
    if (report.sandboxViolations.length > 0) {
      title = "fix(security): adequação de sandbox path-guard em ferramentas do agente";
    } else if (report.testGaps.length > 0) {
      title = "test(coverage): inclusão de testes unitários para módulos descobertos";
    }

    const sections: string[] = [];

    sections.push("## 📌 Contexto & Diagnóstico da Auto-Auditoria");
    sections.push(`Auditoria automática realizada em: \`${report.timestamp}\`.`);

    if (report.performance.totalTurns > 0) {
      sections.push("### ⏱️ Métricas de Desempenho e Raciocínio");
      sections.push(`- **Turnos analisados:** ${report.performance.totalTurns}`);
      sections.push(`- **Duração média por turno:** ${report.performance.avgDurationMs}ms`);
      sections.push(`- **Turnos lentos (> 15s):** ${report.performance.slowTurnsCount}`);
      if (report.performance.slowTurns.length > 0) {
        sections.push("\nExemplos de turnos com alta latência:");
        for (const slow of report.performance.slowTurns.slice(0, 3)) {
          sections.push(`- \`${slow.durationMs}ms\` em "${slow.userInput}"`);
        }
      }
    }

    if (report.sandboxViolations.length > 0) {
      sections.push("\n### 🛡️ Violações de Sandbox (path-guard)");
      for (const v of report.sandboxViolations) {
        sections.push(`- ⚠️ **${v.file}**: ${v.issue}`);
      }
    }

    if (report.testGaps.length > 0) {
      sections.push("\n### 🧪 Gaps de Cobertura de Testes");
      sections.push("Os seguintes módulos não possuem arquivos de teste dedicados em `tests/`:");
      for (const g of report.testGaps) {
        sections.push(`- \`${g.sourceModule}\` → Esperado: \`${g.missingTestFile}\``);
      }
    }

    sections.push("\n## 🎯 Proposta Técnica de Resolução");
    sections.push("1. Aplicar validação estrita com `validateAllowedPath` em todas as tools identificadas.");
    sections.push("2. Adicionar testes unitários correspondentes em `tests/`.");
    sections.push("3. Validar a compilação (`npm run build`) e os testes (`npm test`).");

    sections.push("\n## ✅ Critérios de Aceite");
    sections.push("- [ ] 0 violações de sandbox no `path-guard`.");
    sections.push("- [ ] Cobertura de testes unitários adicionada para os módulos listados.");
    sections.push("- [ ] Testes passando com 100% de sucesso.");

    return {
      title,
      body: sections.join("\n"),
      labels: ["audit", "enhancement"],
    };
  }

  /**
   * Executa a criação da issue no GitHub via CLI `gh issue create`.
   */
  async createGitHubIssue(proposal: IssueProposal): Promise<{
    success: boolean;
    url?: string;
    error?: string;
  }> {
    try {
      const args = ["issue", "create", "--title", proposal.title, "--body", proposal.body];
      const { stdout } = await execFileAsync("gh", args, {
        cwd: this.projectRoot,
        windowsHide: true,
      });

      const url = stdout.trim();
      return { success: true, url };
    } catch (error: any) {
      return {
        success: false,
        error: `Falha ao executar 'gh issue create': ${error.message || String(error)}`,
      };
    }
  }
}
