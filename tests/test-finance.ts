import path from "node:path";
import fs from "node:fs/promises";
import { createFinanceTools, formatBRL } from "../src/tools/finance-tools.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("🧪 Iniciando testes do módulo de Finanças (Obsidian)...\n");

  // Diretório de testes temporário dentro do projeto
  const testFinanceDir = path.resolve(process.cwd(), "tests", "temp_financas");
  const allowedPaths = [process.cwd()];

  const financeTools = createFinanceTools(testFinanceDir, allowedPaths);

  try {
    // 1. Teste de Formatação de Moeda
    console.log("1. Testando formatBRL...");
    const formatted = formatBRL(18.5);
    assert(formatted.includes("18,50"), "Formatação de moeda BRL deve conter 18,50");
    console.log("✔ formatBRL validado com sucesso.\n");

    // 2. Teste de gravação de primeiro gasto
    console.log("2. Testando record_expense (primeiro lançamento)...");
    const res1: any = await (financeTools.record_expense as any).execute({
      amount: 18.0,
      description: "Lanche da tarde",
      category: "Alimentação",
      date: "2026-10-03",
    });

    assert(res1.success === true, "record_expense deve retornar sucesso");
    assert(res1.monthTotal === 18.0, "Total do mês deve ser R$ 18,00");
    assert(res1.expense.category === "Alimentação", "Categoria deve ser Alimentação");
    console.log("✔ Primeiro gasto registrado com sucesso.\n");

    // 3. Teste de gravação de múltiplos gastos com somatória matemática precisa
    console.log("3. Testando record_expense (múltiplos lançamentos)...");
    const res2: any = await (financeTools.record_expense as any).execute({
      amount: 32.5,
      description: "Combustível",
      category: "Transporte",
      date: "2026-10-03",
    });
    assert(res2.success === true, "Segundo gasto deve retornar sucesso");
    assert(res2.monthTotal === 50.5, "Total do mês deve ser R$ 50,50 (18 + 32.5)");

    const res3: any = await (financeTools.record_expense as any).execute({
      amount: 12.0,
      description: "Café da manhã",
      category: "Alimentação",
      date: "2026-10-03",
    });
    assert(res3.success === true, "Terceiro gasto deve retornar sucesso");
    assert(res3.monthTotal === 62.5, "Total do mês deve ser R$ 62,50 (50.5 + 12)");
    console.log("✔ Somatórias matemáticas de múltiplos gastos calculadas com precisão.\n");

    // 4. Teste de leitura e resumo (get_financial_summary)
    console.log("4. Testando get_financial_summary...");
    const summary: any = await (financeTools.get_financial_summary as any).execute({
      month: "2026-10",
    });

    assert(summary.success === true, "get_financial_summary deve ter sucesso");
    assert(summary.recordsCount === 3, "Deve listar 3 transações");
    assert(summary.totalAmount.includes("62,50"), "Total deve ser R$ 62,50");

    // Filtro por categoria
    const catSummary: any = await (financeTools.get_financial_summary as any).execute({
      month: "2026-10",
      category: "Alimentação",
    });
    assert(catSummary.success === true, "Consulta por categoria deve ter sucesso");
    assert(catSummary.recordsCount === 2, "Alimentação deve ter 2 transações");
    assert(catSummary.totalAmount.includes("30,00"), "Total de Alimentação deve ser R$ 30,00 (18 + 12)");
    console.log("✔ Consultas e filtros por categoria validados com sucesso.\n");

    // 5. Teste de validação do arquivo Markdown gerado
    console.log("5. Testando integridade do arquivo Markdown no Obsidian...");
    const targetMd = path.join(testFinanceDir, "2026-10.md");
    const content = await fs.readFile(targetMd, "utf-8");

    assert(content.includes("# 💰 Finanças - Outubro de 2026"), "Deve conter título do mês");
    assert(content.includes("Total Gasto no Mês:"), "Deve conter cabeçalho com total");
    assert(content.includes("Lanche da tarde"), "Deve conter descrição do lançamento");
    assert(content.includes("<!-- METADATA:"), "Deve conter bloco de metadados seguro");
    console.log("✔ Arquivo Markdown e metadados validados com sucesso.\n");

    // 6. Teste de Bloqueio de Segurança (Path Guard)
    console.log("6. Testando bloqueio fora das pastas permitidas...");
    const blockedTools = createFinanceTools("C:\\Windows\\System32\\Financas", allowedPaths);
    const blockedRes: any = await (blockedTools.record_expense as any).execute({
      amount: 10,
      description: "Teste bloqueado",
      date: "2026-10-03",
    });
    assert(blockedRes.success === false, "Gravação fora da whitelist deve ser bloqueada");
    assert(blockedRes.error.includes("Acesso negado"), "Deve retornar erro de acesso negado");
    console.log("✔ Trava de segurança no módulo de finanças validada com sucesso.\n");

    console.log("🎉 Todos os testes de Finanças passaram com 100% de sucesso!");
  } finally {
    // Limpeza da pasta temporária de testes
    try {
      await fs.rm(testFinanceDir, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Erro inesperado nos testes de finanças:", err);
  process.exit(1);
});
