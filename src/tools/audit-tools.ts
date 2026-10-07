import { tool } from "ai";
import { z } from "zod";
import { SelfAuditor } from "../core/self-auditor.js";

export function createAuditTools(auditor: SelfAuditor) {
  return {
    run_self_audit: tool({
      description:
        "Executa uma auto-auditoria holística do projeto: analisa histórico de latência e performance (logs/reasoning.log), conformidade de sandbox com path-guard (AGENTS.md) e cobertura de testes. Retorna diagnósticos e minuta de issue técnica.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const report = await auditor.runAudit();
          const proposal = auditor.generateIssueProposal(report);

          return {
            success: true,
            report: {
              timestamp: report.timestamp,
              performance: {
                totalTurns: report.performance.totalTurns,
                avgDurationMs: report.performance.avgDurationMs,
                slowTurnsCount: report.performance.slowTurnsCount,
              },
              sandboxViolationsCount: report.sandboxViolations.length,
              sandboxViolations: report.sandboxViolations,
              testGapsCount: report.testGaps.length,
              testGaps: report.testGaps,
            },
            issueProposal: proposal
              ? {
                  title: proposal.title,
                  bodyPreview: proposal.body.slice(0, 500) + "...",
                  fullBody: proposal.body,
                  labels: proposal.labels,
                }
              : null,
            message: proposal
              ? "Auditoria concluída com inconsistências encontradas. Minuta de issue preparada para revisão do usuário."
              : "Auditoria concluída com sucesso: nenhuma inconsistência crítica detectada no projeto.",
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Erro ao executar auto-auditoria: ${error.message}`,
          };
        }
      },
    }),
  };
}
