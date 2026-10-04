import path from "node:path";
import fs from "node:fs/promises";
import {
  createFinanceTools,
  formatBRL,
  extractMetadata,
  analyzeBurnRate,
  resolveMonthQuery,
  readMasterBalance,
  MASTER_BALANCE_FILENAME,
} from "../src/tools/finance-tools.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("🧪 Iniciando testes do módulo de Finanças (Obsidian) com Carteiras Dinâmicas...\n");

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

    // 2. Teste de gravação de primeiro gasto na Conta Corrente
    console.log("2. Testando record_expense (primeiro lançamento em conta_corrente)...");
    const res1: any = await (financeTools.record_expense as any).execute({
      amount: 18.0,
      description: "Lanche da tarde",
      category: "Alimentação",
      wallet: "conta_corrente",
      date: "2026-10-03",
    });

    assert(res1.success === true, "record_expense deve retornar sucesso");
    assert(res1.expense.wallet === "conta_corrente", "Carteira deve ser conta_corrente");
    assert(res1.monthTotal === 18.0, "Total do mês deve ser R$ 18,00");
    console.log("✔ Primeiro gasto registrado com sucesso na conta corrente.\n");

    // 3. Teste de múltiplos lançamentos na Conta Corrente
    console.log("3. Testando múltiplos lançamentos na conta corrente...");
    const res2: any = await (financeTools.record_expense as any).execute({
      amount: 32.5,
      description: "Combustível",
      category: "Transporte",
      wallet: "conta_corrente",
      date: "2026-10-03",
    });
    assert(res2.success === true, "Segundo gasto deve retornar sucesso");
    assert(res2.walletTotals.totalExpense === 50.5, "Total da conta corrente deve ser R$ 50,50");
    console.log("✔ Múltiplos gastos na conta corrente somados com precisão.\n");

    // 4. Teste de Carteira Separada: Vale Alimentação (VA)
    console.log("4. Testando carteira de Vale Alimentação (record_income e record_expense no VA)...");
    // Crédito do benefício VA
    const vaIncome: any = await (financeTools.record_income as any).execute({
      amount: 954.55,
      description: "Benefício Vale Alimentação",
      category: "Benefício",
      wallet: "va",
      date: "2026-10-01",
    });
    assert(vaIncome.success === true, "record_income no VA deve ter sucesso");
    assert(vaIncome.income.wallet === "va", "Carteira da receita deve ser va");
    assert(vaIncome.totals.wallets.va.balance === 954.55, "Saldo do VA deve ser R$ 954,55");

    // Gasto no VA (ex: Jantar com a Lailla)
    const vaExpense: any = await (financeTools.record_expense as any).execute({
      amount: 205.7,
      description: "Jantar com a Lailla",
      category: "Alimentação",
      wallet: "va",
      date: "2026-10-02",
    });
    assert(vaExpense.success === true, "Gasto no VA deve ter sucesso");
    assert(vaExpense.expense.wallet === "va", "Carteira do gasto deve ser va");
    assert(vaExpense.walletTotals.totalExpense === 205.7, "Gastos no VA devem ser R$ 205,70");
    assert(vaExpense.walletTotals.balance === 748.85, "Saldo restante do VA deve ser R$ 748,85 (954.55 - 205.70)");

    // Saldo da Conta Corrente NÃO deve ter sido afetado pelo gasto no VA!
    assert(vaExpense.totals.wallets.conta_corrente.totalExpense === 50.5, "Conta corrente deve manter seus R$ 50,50 de gastos");
    console.log("✔ Carteira de Vale Alimentação isolada matematicamente com sucesso!\n");

    // 5. Teste de Salário na Conta Corrente
    console.log("5. Testando lançamento de salário na Conta Corrente...");
    const salIncome: any = await (financeTools.record_income as any).execute({
      amount: 2064.85,
      description: "Salário Mensal",
      category: "Salário",
      wallet: "conta_corrente",
      date: "2026-10-04",
    });
    assert(salIncome.success === true, "Salário registrado com sucesso");
    const ccWallet = salIncome.totals.wallets.conta_corrente;
    assert(ccWallet.totalIncome === 2064.85, "Salário na conta corrente deve ser R$ 2.064,85");
    assert(ccWallet.totalExpense === 50.5, "Despesas da conta corrente devem ser R$ 50,50");
    assert(ccWallet.balance === 2014.35, "Saldo livre da conta corrente deve ser R$ 2.014,35 (2064.85 - 50.50)");
    console.log("✔ Saldo livre da Conta Corrente calculado com precisão.\n");

    // 6. Teste de get_financial_summary com e sem filtro de carteira
    console.log("6. Testando get_financial_summary geral e por carteira...");
    const generalSummary: any = await (financeTools.get_financial_summary as any).execute({
      month: "2026-10",
    });
    assert(generalSummary.success === true, "Resumo geral deve ter sucesso");
    assert(generalSummary.wallets.conta_corrente.balance === 2014.35, "Saldo da conta corrente no resumo deve bater");
    assert(generalSummary.wallets.va.balance === 748.85, "Saldo do VA no resumo deve bater");

    // Filtro por carteira 'va'
    const vaSummary: any = await (financeTools.get_financial_summary as any).execute({
      month: "2026-10",
      wallet: "va",
    });
    assert(vaSummary.success === true, "Resumo do VA deve ter sucesso");
    assert(vaSummary.recordsCount === 2, "VA deve ter 2 lançamentos (1 crédito + 1 gasto)");
    console.log("✔ Resumos gerais e filtrados por carteira validados com sucesso.\n");

    // 7. Teste do parser neutro resolveMonthQuery
    console.log("7. Testando resolveMonthQuery (resolução semântica neutra)...");
    const q1 = resolveMonthQuery("setembro");
    assert(q1.yearMonth?.endsWith("-09"), "Deve resolver 'setembro' para mês 09");

    const q2 = resolveMonthQuery("2026-09");
    assert(q2.yearMonth === "2026-09", "Deve resolver '2026-09'");

    const q3 = resolveMonthQuery("va");
    assert(q3.wallet === "va", "Deve detectar carteira 'va'");

    const q4 = resolveMonthQuery("setembro va");
    assert(q4.yearMonth?.endsWith("-09") && q4.wallet === "va", "Deve resolver mês 'setembro' e carteira 'va'");
    console.log("✔ resolveMonthQuery validado com sucesso.\n");

    // 8. Teste de análise de ritmo de queima (Burn Rate & Alertas)
    console.log("8. Testando análise matemática de ritmo de queima (Burn Rate)...");
    const alertAnalysis = analyzeBurnRate("2026-10", 180000, 200000, "2026-10-05");
    assert(alertAnalysis.spentIncomePercent === 90, "Deve calcular 90% da renda consumida");
    assert(typeof alertAnalysis.alert === "string", "Deve emitir alerta de orçamento crítico");
    console.log("✔ Alertas de ritmo de queima calculados com sucesso.\n");

    // 9. Teste de cancel_last_transaction
    console.log("9. Testando cancel_last_transaction (desfazer lançamento e reverter Saldo Mestre)...");
    const cancelRes: any = await (financeTools.cancel_last_transaction as any).execute({
      month: "2026-10",
    });
    assert(cancelRes.success === true, "cancel_last_transaction deve ter sucesso");
    assert(cancelRes.cancelledTransaction.description === "Salário Mensal", "Deve desfazer o último lançamento");
    assert(cancelRes.masterBalance === -50.5, "Saldo Mestre da conta corrente deve ter sido revertido para -50.50");
    console.log("✔ Desfazer lançamento e reversão do Saldo Mestre validados com sucesso.\n");

    // 10. Teste de retrocompatibilidade com registros legados (sem wallet nem type)
    console.log("10. Testando retrocompatibilidade com registros legados...");
    const legacyJson = `
# 💰 Finanças - Setembro de 2026
<!-- METADATA:
[
  {
    "id": "exp_legacy_1",
    "date": "2026-09-15",
    "time": "14:30",
    "category": "Tecnologia",
    "description": "Mouse sem fio",
    "amount": 150.00
  }
]
-->
`;
    const migrated = extractMetadata(legacyJson);
    assert(migrated.length === 1, "Deve extrair 1 registro legado");
    assert(migrated[0].type === "expense", "Registro sem type deve ser migrado para 'expense'");
    assert(migrated[0].wallet === "conta_corrente", "Registro sem wallet deve ser migrado para 'conta_corrente'");
    console.log("✔ Retrocompatibilidade com registros legados validada com sucesso.\n");

    // 11. Teste de ajuste manual de saldo de carteira (adjust_wallet_balance)
    console.log("11. Testando adjust_wallet_balance (calibração/conciliação manual de saldo)...");
    const adjustRes: any = await (financeTools.adjust_wallet_balance as any).execute({
      wallet: "va",
      newBalance: 800.0,
      reason: "Conciliação com extrato do app Pluxee",
    });
    assert(adjustRes.success === true, "adjust_wallet_balance deve retornar sucesso");
    assert(adjustRes.wallet === "va", "Carteira ajustada deve ser 'va'");
    assert(adjustRes.oldBalance === 748.85, "Saldo anterior do VA deve ser R$ 748,85");
    assert(adjustRes.newBalance === 800.0, "Novo saldo do VA deve ser R$ 800,00");
    console.log("✔ adjust_wallet_balance validado com sucesso.\n");

    // 12. Teste de persistência e integridade do saldo-mestre.md
    console.log("12. Testando persistência e integridade do saldo-mestre.md...");
    const masterPath = path.join(testFinanceDir, MASTER_BALANCE_FILENAME);
    const masterContent = await fs.readFile(masterPath, "utf-8");
    assert(masterContent.includes("# 🏦 Saldo Mestre & Carteiras"), "saldo-mestre.md deve conter cabeçalho");
    assert(masterContent.includes("🍎 Vale Alimentação (VA)"), "saldo-mestre.md deve conter label do VA");
    assert(masterContent.includes("💳 Conta Corrente (Salário & Livre)"), "saldo-mestre.md deve conter label da Conta Corrente");

    const masterData = await readMasterBalance(testFinanceDir, allowedPaths);
    assert(masterData.wallets.va.balance === 800.0, "Saldo do VA no Saldo Mestre deve ser R$ 800,00");
    assert(masterData.wallets.conta_corrente.balance === -50.5, "Saldo da conta corrente no Saldo Mestre deve ser -R$ 50,50");
    assert(masterData.wallets.va.lastTransactionDescription === "Conciliação com extrato do app Pluxee", "Descrição da última movimentação deve ser o motivo do ajuste");
    console.log("✔ Persistência e integridade do saldo-mestre.md validadas com sucesso.\n");

    console.log("🎉 Todos os 12 testes de Finanças com Carteiras e Saldo Mestre passaram com 100% de sucesso!");
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
