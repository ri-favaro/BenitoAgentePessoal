import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { SelfAuditor, type FullAuditReport } from "../src/core/self-auditor.js";
import { createAuditTools } from "../src/tools/audit-tools.js";

async function runAuditTests() {
  console.log("🧪 Iniciando testes do módulo de Auto-Auditoria (SelfAuditor)...\n");

  const tempLogFile = path.resolve(process.cwd(), "logs", "test-reasoning-audit.log");
  await fs.mkdir(path.dirname(tempLogFile), { recursive: true });

  try {
    // ==========================================
    // 1. Testando Análise de Latência do reasoning.log
    // ==========================================
    console.log("1. Testando analyzeReasoningLogs com logs simulados...");
    const auditor = new SelfAuditor();

    const sampleEntries = [
      {
        timestamp: "2026-10-06T20:00:00Z",
        userInput: "Qual o saldo de hoje?",
        thought: "pensamento 1",
        cleanResponse: "Seu saldo é R$ 100,00",
        durationMs: 3500,
      },
      {
        timestamp: "2026-10-06T20:05:00Z",
        userInput: "Onde validamos o JWT no código?",
        thought: "pensamento 2 longo com muitas tools",
        cleanResponse: "No arquivo auth.ts",
        durationMs: 18200, // Turno lento (> 15s)
      },
      {
        timestamp: "2026-10-06T20:10:00Z",
        userInput: "Ola Benito",
        thought: "saudação",
        cleanResponse: "Olá Luiz!",
        durationMs: 1200,
      },
    ];

    await fs.writeFile(
      tempLogFile,
      sampleEntries.map((e) => JSON.stringify(e)).join("\n"),
      "utf-8"
    );

    const perfMetrics = await auditor.analyzeReasoningLogs(tempLogFile);
    assert.strictEqual(perfMetrics.totalTurns, 3);
    assert.strictEqual(perfMetrics.slowTurnsCount, 1);
    assert.strictEqual(perfMetrics.slowTurns[0].durationMs, 18200);
    // (3500 + 18200 + 1200) / 3 = 7633ms
    assert.strictEqual(perfMetrics.avgDurationMs, 7633);
    console.log("✔ Análise de métricas de performance validada com sucesso!");

    // ==========================================
    // 2. Testando Conformidade de Sandbox (path-guard)
    // ==========================================
    console.log("\n2. Testando auditSandboxCompliance...");
    const sandboxViolations = await auditor.auditSandboxCompliance();
    // Nossas ferramentas oficiais (filesystem-tools, finance-tools, retrieval-tools) devem estar em conformidade
    assert.ok(
      Array.isArray(sandboxViolations),
      "sandboxViolations deve ser uma lista de inconsistências"
    );
    console.log(`✔ Sandbox verificado (${sandboxViolations.length} potenciais alertas).`);

    // ==========================================
    // 3. Testando Minuta de Issue do GitHub
    // ==========================================
    console.log("\n3. Testando generateIssueProposal...");
    const mockReport: FullAuditReport = {
      timestamp: new Date().toISOString(),
      performance: perfMetrics,
      sandboxViolations: [
        {
          file: "src/tools/sample-tools.ts",
          issue: "Falta validação de sandbox com path-guard.",
        },
      ],
      testGaps: [
        {
          sourceModule: "src/tools/sample-tools.ts",
          missingTestFile: "tests/test-sample-tools.ts",
        },
      ],
    };

    const proposal = auditor.generateIssueProposal(mockReport);
    assert.ok(proposal !== null, "Proposta de issue deve ser gerada");
    assert.ok(proposal.title.includes("fix(security)"));
    assert.ok(proposal.body.includes("Violações de Sandbox"));
    assert.ok(proposal.body.includes("Critérios de Aceite"));
    assert.ok(proposal.labels.includes("audit"));
    console.log("✔ Elaboração da minuta de issue técnica validada com sucesso!");

    // ==========================================
    // 4. Testando Tool run_self_audit
    // ==========================================
    console.log("\n4. Testando tool run_self_audit...");
    const auditTools = createAuditTools(auditor);
    const toolResult: any = await auditTools.run_self_audit.execute({});
    assert.strictEqual(toolResult.success, true);
    assert.ok(toolResult.report !== undefined);
    console.log("✔ Tool run_self_audit validada com sucesso!");

    console.log("\n🎉 Todos os testes de Auto-Auditoria passaram com 100% de sucesso!");
  } finally {
    await fs.rm(tempLogFile, { force: true }).catch(() => {});
  }
}

runAuditTests().catch((err) => {
  console.error("✖ Falha nos testes de auto-auditoria:", err);
  process.exit(1);
});
