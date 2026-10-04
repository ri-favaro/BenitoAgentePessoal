import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { validateAllowedPath } from "./path-guard.js";

export type TransactionType = "expense" | "income";

export interface FinancialTransaction {
  id: string;
  type: TransactionType; // "expense" | "income"
  wallet: string; // "conta_corrente" | "va" | carteiras customizadas
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: string;
  description: string;
  amount: number;
}

// Alias para compatibilidade com código legado
export type ExpenseRecord = FinancialTransaction;

export const MASTER_BALANCE_FILENAME = "saldo-mestre.md";

export interface WalletState {
  wallet: string;
  label: string;
  balanceCents: number;
  balance: number;
  lastUpdate: string;
  lastTransactionDescription?: string;
  lastTransactionAmount?: number;
  lastTransactionType?: "income" | "expense" | "adjustment";
}

export interface MasterBalanceData {
  updatedAt: string;
  wallets: Record<string, WalletState>;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseMonthYear(dateStr?: string): { yearMonth: string; monthTitle: string } {
  let dateObj = new Date();
  if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
    const [y, m] = dateStr.split("-").map(Number);
    if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
      dateObj = new Date(y, m - 1, 1);
    }
  }

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const monthName = MONTH_NAMES[dateObj.getMonth()];

  return {
    yearMonth: `${year}-${month}`,
    monthTitle: `${monthName} de ${year}`,
  };
}

export function getWalletLabel(wallet: string): string {
  const norm = (wallet || "conta_corrente").toLowerCase();
  if (norm === "conta_corrente") return "💳 Conta Corrente (Salário & Livre)";
  if (norm === "va") return "🍎 Vale Alimentação (VA)";
  if (norm === "vr") return "🍽️ Vale Refeição (VR)";
  return `📁 ${norm.charAt(0).toUpperCase() + norm.slice(1)}`;
}

export function resolveMonthQuery(query?: string): { yearMonth?: string; monthTitle?: string; wallet?: string } {
  if (!query || !query.trim()) return {};

  const clean = query.trim().toLowerCase();
  let wallet: string | undefined;

  if (/\b(va|vale|alimentacao|alimentação)\b/.test(clean)) {
    wallet = "va";
  } else if (/\b(conta|corrente|geral|pessoal)\b/.test(clean)) {
    wallet = "conta_corrente";
  }

  const yyyyMmMatch = clean.match(/\b(20\d\d)-(0[1-9]|1[0-2])\b/);
  if (yyyyMmMatch) {
    const y = parseInt(yyyyMmMatch[1], 10);
    const m = parseInt(yyyyMmMatch[2], 10);
    return {
      yearMonth: `${y}-${String(m).padStart(2, "0")}`,
      monthTitle: `${MONTH_NAMES[m - 1]} de ${y}`,
      wallet,
    };
  }

  const currentYear = new Date().getFullYear();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const name = MONTH_NAMES[i].toLowerCase();
    const prefix = name.slice(0, 3);
    if (clean.includes(name) || new RegExp(`\\b${prefix}\\b`).test(clean)) {
      const monthNum = String(i + 1).padStart(2, "0");
      return {
        yearMonth: `${currentYear}-${monthNum}`,
        monthTitle: `${MONTH_NAMES[i]} de ${currentYear}`,
        wallet,
      };
    }
  }

  const numMatch = clean.match(/\b(0?[1-9]|1[0-2])\b/);
  if (numMatch) {
    const m = parseInt(numMatch[1], 10);
    return {
      yearMonth: `${currentYear}-${String(m).padStart(2, "0")}`,
      monthTitle: `${MONTH_NAMES[m - 1]} de ${currentYear}`,
      wallet,
    };
  }

  return { wallet };
}

export function extractMetadata(fileContent: string): FinancialTransaction[] {
  const match = fileContent.match(/<!-- METADATA:\s*([\s\S]*?)\s*-->/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      type: item.type === "income" ? ("income" as const) : ("expense" as const),
      wallet:
        typeof item.wallet === "string" && item.wallet.trim()
          ? item.wallet.trim().toLowerCase()
          : "conta_corrente",
    }));
  } catch {
    return [];
  }
}

export async function readMasterBalance(
  financeDir: string,
  allowedPaths: string[]
): Promise<MasterBalanceData> {
  const masterFile = path.join(financeDir, MASTER_BALANCE_FILENAME);
  const validation = validateAllowedPath(masterFile, allowedPaths);
  if (!validation.allowed) {
    return { updatedAt: new Date().toISOString(), wallets: {} };
  }

  try {
    const content = await fs.readFile(masterFile, "utf-8");
    const match = content.match(/<!-- METADATA:\s*([\s\S]*?)\s*-->/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === "object" && parsed.wallets) {
        return parsed as MasterBalanceData;
      }
    }
  } catch {}

  return {
    updatedAt: new Date().toISOString(),
    wallets: {
      conta_corrente: {
        wallet: "conta_corrente",
        label: getWalletLabel("conta_corrente"),
        balanceCents: 0,
        balance: 0,
        lastUpdate: new Date().toISOString(),
      },
      va: {
        wallet: "va",
        label: getWalletLabel("va"),
        balanceCents: 0,
        balance: 0,
        lastUpdate: new Date().toISOString(),
      },
    },
  };
}

export function generateMasterBalanceMarkdown(data: MasterBalanceData, updatedAtStr: string): string {
  let totalCents = 0;
  let walletsMarkdown = "";

  const entries = Object.values(data.wallets);
  for (const w of entries) {
    totalCents += w.balanceCents;
    const lastTx = w.lastTransactionDescription
      ? `\n  - *Última movimentação:* ${w.lastTransactionType === "income" ? "🟢 Entrada" : w.lastTransactionType === "expense" ? "🔴 Saída" : "⚖️ Ajuste"} de ${formatBRL(w.lastTransactionAmount || 0)} (${w.lastTransactionDescription})`
      : "";

    walletsMarkdown += `### ${w.label}\n- **Saldo Atual:** ${formatBRL(w.balance)}${lastTx}\n\n`;
  }

  const metadataJson = JSON.stringify(data, null, 2);

  return `# 🏦 Saldo Mestre & Carteiras

> **Última Atualização:** ${updatedAtStr}  
> **Patrimônio Rastreado Total:** ${formatBRL(totalCents / 100)}

---

## 💳 Posição Atual por Carteira

${walletsMarkdown}---
*Atualizado automaticamente pelo Benito 🤖*

<!-- METADATA:
${metadataJson}
-->
`;
}

export async function writeMasterBalance(
  financeDir: string,
  allowedPaths: string[],
  data: MasterBalanceData
): Promise<void> {
  const masterFile = path.join(financeDir, MASTER_BALANCE_FILENAME);
  const validation = validateAllowedPath(masterFile, allowedPaths);
  if (!validation.allowed) return;

  await fs.mkdir(financeDir, { recursive: true });
  const now = new Date();
  const updatedAtStr = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  data.updatedAt = updatedAtStr;

  const md = generateMasterBalanceMarkdown(data, updatedAtStr);
  await fs.writeFile(masterFile, md, "utf-8");
}

export interface WalletTotals {
  wallet: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface MonthlyFinancialTotals {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  wallets: Record<string, WalletTotals>;
}

export function calculateMonthlyTotals(records: FinancialTransaction[]): MonthlyFinancialTotals {
  let globalIncomeCents = 0;
  let globalExpenseCents = 0;
  const walletsMap = new Map<string, { incomeCents: number; expenseCents: number }>();

  for (const r of records) {
    const cents = Math.round(r.amount * 100);
    const wKey = (r.wallet || "conta_corrente").toLowerCase();
    const current = walletsMap.get(wKey) || { incomeCents: 0, expenseCents: 0 };

    if (r.type === "income") {
      globalIncomeCents += cents;
      current.incomeCents += cents;
    } else {
      globalExpenseCents += cents;
      current.expenseCents += cents;
    }

    walletsMap.set(wKey, current);
  }

  if (!walletsMap.has("conta_corrente")) {
    walletsMap.set("conta_corrente", { incomeCents: 0, expenseCents: 0 });
  }

  const wallets: Record<string, WalletTotals> = {};
  for (const [w, data] of walletsMap.entries()) {
    const balCents = data.incomeCents - data.expenseCents;
    wallets[w] = {
      wallet: w,
      label: getWalletLabel(w),
      incomeCents: data.incomeCents,
      expenseCents: data.expenseCents,
      balanceCents: balCents,
      totalIncome: data.incomeCents / 100,
      totalExpense: data.expenseCents / 100,
      balance: balCents / 100,
    };
  }

  return {
    totalIncome: globalIncomeCents / 100,
    totalExpense: globalExpenseCents / 100,
    balance: (globalIncomeCents - globalExpenseCents) / 100,
    wallets,
  };
}

export interface BurnRateAnalysis {
  daysInMonth: number;
  currentDay: number;
  elapsedPercent: number;
  dailyExpenseRate: number;
  spentIncomePercent?: number;
  alert?: string;
}

export function analyzeBurnRate(
  yearMonth: string,
  totalExpenseCents: number,
  totalIncomeCents: number,
  referenceDateStr?: string
): BurnRateAnalysis {
  const [y, m] = yearMonth.split("-").map(Number);
  const now = referenceDateStr ? new Date(`${referenceDateStr}T12:00:00`) : new Date();
  const daysInMonth = new Date(y, m, 0).getDate();

  let currentDay = now.getDate();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (yearMonth < currentYearMonth) {
    currentDay = daysInMonth;
  } else if (yearMonth > currentYearMonth) {
    currentDay = 1;
  }

  const elapsedPercent = Math.min(100, Math.max(1, Math.round((currentDay / daysInMonth) * 100)));
  const dailyExpenseRate = currentDay > 0 ? totalExpenseCents / 100 / currentDay : totalExpenseCents / 100;

  let spentIncomePercent: number | undefined;
  let alert: string | undefined;

  if (totalIncomeCents > 0) {
    spentIncomePercent = Math.round((totalExpenseCents / totalIncomeCents) * 100);

    if (totalExpenseCents > totalIncomeCents) {
      alert = `🚨 Alerta Crítico: As despesas superaram a receita em ${formatBRL((totalExpenseCents - totalIncomeCents) / 100)}!`;
    } else if (spentIncomePercent >= 80 && elapsedPercent < 80) {
      alert = `⚠️ Alerta de Orçamento: Você já consumiu ${spentIncomePercent}% da receita desta carteira, restando ainda ${daysInMonth - currentDay} dias no ciclo.`;
    } else if (spentIncomePercent >= 50 && elapsedPercent <= 30) {
      alert = `⚠️ Atenção ao Ritmo: ${spentIncomePercent}% da receita consumida em apenas ${currentDay} dias (ritmo de ${formatBRL(dailyExpenseRate)}/dia).`;
    }
  }

  return {
    daysInMonth,
    currentDay,
    elapsedPercent,
    dailyExpenseRate: Math.round(dailyExpenseRate * 100) / 100,
    spentIncomePercent,
    alert,
  };
}

export function generateMarkdown(
  monthTitle: string,
  yearMonth: string,
  records: FinancialTransaction[],
  updatedAt: string,
  referenceDateStr?: string
): string {
  const totals = calculateMonthlyTotals(records);
  const mainWallet = totals.wallets["conta_corrente"] || { totalIncome: 0, totalExpense: 0, balance: 0, expenseCents: 0, incomeCents: 0 };
  const burn = analyzeBurnRate(yearMonth, mainWallet.expenseCents, mainWallet.incomeCents, referenceDateStr);

  const expenses = records.filter((r) => r.type === "expense");
  const incomes = records.filter((r) => r.type === "income");

  const expenseCatMap = new Map<string, { count: number; cents: number }>();
  for (const r of expenses) {
    const current = expenseCatMap.get(r.category) || { count: 0, cents: 0 };
    current.count += 1;
    current.cents += Math.round(r.amount * 100);
    expenseCatMap.set(r.category, current);
  }

  const sortedExpenseCats = Array.from(expenseCatMap.entries()).sort(
    (a, b) => b[1].cents - a[1].cents
  );

  let expenseTable = "| Categoria | Total | Qtd. |\n| :--- | :--- | :--- |\n";
  if (sortedExpenseCats.length === 0) {
    expenseTable += "| *Nenhuma despesa* | R$ 0,00 | 0 |\n";
  } else {
    for (const [cat, data] of sortedExpenseCats) {
      expenseTable += `| ${cat} | ${formatBRL(data.cents / 100)} | ${data.count} |\n`;
    }
  }

  const incomeCatMap = new Map<string, { count: number; cents: number }>();
  for (const r of incomes) {
    const current = incomeCatMap.get(r.category) || { count: 0, cents: 0 };
    current.count += 1;
    current.cents += Math.round(r.amount * 100);
    incomeCatMap.set(r.category, current);
  }

  const sortedIncomeCats = Array.from(incomeCatMap.entries()).sort(
    (a, b) => b[1].cents - a[1].cents
  );

  let incomeTable = "| Categoria | Total | Qtd. |\n| :--- | :--- | :--- |\n";
  if (sortedIncomeCats.length === 0) {
    incomeTable += "| *Nenhuma receita* | R$ 0,00 | 0 |\n";
  } else {
    for (const [cat, data] of sortedIncomeCats) {
      incomeTable += `| ${cat} | ${formatBRL(data.cents / 100)} | ${data.count} |\n`;
    }
  }

  let transactionsTable =
    "| Data | Horário | Tipo | Carteira | Categoria | Descrição | Valor |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
  if (records.length === 0) {
    transactionsTable += "| - | - | - | - | - | *Nenhuma transação* | - |\n";
  } else {
    const reversed = [...records].reverse();
    for (const r of reversed) {
      const [y, m, d] = r.date.split("-");
      const dateFormatted = `${d}/${m}/${y}`;
      const typeBadge = r.type === "income" ? "🟢 Receita" : "🔴 Despesa";
      const walletBadge = r.wallet === "va" ? "🍎 VA" : "💳 Conta Corrente";
      transactionsTable += `| ${dateFormatted} | ${r.time} | ${typeBadge} | ${walletBadge} | ${r.category} | ${r.description} | ${formatBRL(r.amount)} |\n`;
    }
  }

  const metadataJson = JSON.stringify(records, null, 2);

  let walletsPanel = "";
  for (const [key, w] of Object.entries(totals.wallets)) {
    if (key === "conta_corrente") {
      const freePct = w.totalIncome > 0 ? ` *(${Math.max(0, Math.round((w.balance / w.totalIncome) * 100))}% livre)*` : "";
      walletsPanel += `> ${w.label}:\n> 🟢 Receitas: ${formatBRL(w.totalIncome)} | 🔴 Despesas: ${formatBRL(w.totalExpense)} | ⚖️ **Fluxo do Mês: ${formatBRL(w.balance)}**${freePct}\n>\n`;
    } else if (key === "va") {
      const remainingPct = w.totalIncome > 0 ? ` *(${Math.max(0, Math.round((w.balance / w.totalIncome) * 100))}% restante)*` : "";
      walletsPanel += `> ${w.label}:\n> 🟢 Benefício: ${formatBRL(w.totalIncome)} | 🔴 Gastos no VA: ${formatBRL(w.totalExpense)} | ⚖️ **Fluxo do Mês: ${formatBRL(w.balance)}**${remainingPct}\n>\n`;
    } else {
      walletsPanel += `> ${w.label}:\n> 🟢 Entradas: ${formatBRL(w.totalIncome)} | 🔴 Saídas: ${formatBRL(w.totalExpense)} | ⚖️ **Fluxo do Mês: ${formatBRL(w.balance)}**\n>\n`;
    }
  }

  const alertLine = burn.alert ? `> \n> ${burn.alert}\n` : "";

  return `# 💰 Finanças - ${monthTitle}

${walletsPanel}> ⏱️ **Ritmo Médio (Conta Corrente):** ${formatBRL(burn.dailyExpenseRate)}/dia | **Última Atualização:** ${updatedAt}
${alertLine}
---

## 📊 Resumo por Categoria

### 🔴 Despesas
${expenseTable}
### 🟢 Receitas
${incomeTable}
---

## 📝 Histórico de Transações

${transactionsTable}
---
*Gerado automaticamente pelo Benito 🤖*

<!-- METADATA:
${metadataJson}
-->
`;
}

export function createFinanceTools(
  financeDir: string = config.finance.financeDir,
  allowedPaths: string[] = config.filesystem.allowedPaths
) {
  return {
    record_income: tool({
      description:
        "Registra uma receita, salário, pagamento ou crédito de benefício (Vale Alimentação) no Obsidian. " +
        "Atualiza tanto a nota mensal (YYYY-MM.md) quanto o 'saldo-mestre.md' com o novo saldo acumulado em tempo real.",
      parameters: z.object({
        amount: z.number().positive().describe("Valor monetário em reais (ex: 2064.85, 954.55)."),
        description: z.string().describe("Descrição da entrada (ex: 'Salário Mensal', 'Benefício Vale Alimentação')."),
        category: z
          .string()
          .optional()
          .default("Salário")
          .describe("Categoria da receita (ex: 'Salário', 'Benefício', 'Investimentos', 'Freelance')."),
        wallet: z
          .string()
          .optional()
          .default("conta_corrente")
          .describe("Carteira de destino: 'conta_corrente' (salário/dinheiro livre) ou 'va' (crédito de Vale Alimentação)."),
        date: z
          .string()
          .optional()
          .describe("Data no formato YYYY-MM-DD. Se omitida, usa a data atual."),
      }),
      execute: async ({ amount, description, category = "Salário", wallet = "conta_corrente", date }) => {
        try {
          const now = new Date();
          const incomeDate =
            date && /^\d{4}-\d{2}-\d{2}$/.test(date)
              ? date
              : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

          const incomeTime = now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const { yearMonth, monthTitle } = parseMonthYear(incomeDate);
          const targetFile = path.join(financeDir, `${yearMonth}.md`);

          const validation = validateAllowedPath(targetFile, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          await fs.mkdir(financeDir, { recursive: true });

          let existingRecords: FinancialTransaction[] = [];
          try {
            const content = await fs.readFile(targetFile, "utf-8");
            existingRecords = extractMetadata(content);
          } catch {}

          const cleanCategory =
            category.trim().charAt(0).toUpperCase() + category.trim().slice(1).toLowerCase();
          const cleanWallet = wallet.trim().toLowerCase();

          const newRecord: FinancialTransaction = {
            id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "income",
            wallet: cleanWallet,
            date: incomeDate,
            time: incomeTime,
            category: cleanCategory,
            description: description.trim(),
            amount: Math.round(amount * 100) / 100,
          };

          existingRecords.push(newRecord);

          const updatedAt = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
          const markdown = generateMarkdown(monthTitle, yearMonth, existingRecords, updatedAt, incomeDate);
          await fs.writeFile(targetFile, markdown, "utf-8");

          // Atualiza o Saldo Mestre
          const master = await readMasterBalance(financeDir, allowedPaths);
          const wState = master.wallets[cleanWallet] || {
            wallet: cleanWallet,
            label: getWalletLabel(cleanWallet),
            balanceCents: 0,
            balance: 0,
            lastUpdate: now.toISOString(),
          };

          wState.balanceCents += Math.round(amount * 100);
          wState.balance = wState.balanceCents / 100;
          wState.lastUpdate = now.toISOString();
          wState.lastTransactionDescription = description.trim();
          wState.lastTransactionAmount = Math.round(amount * 100) / 100;
          wState.lastTransactionType = "income";

          master.wallets[cleanWallet] = wState;
          await writeMasterBalance(financeDir, allowedPaths, master);

          const totals = calculateMonthlyTotals(existingRecords);

          return {
            success: true,
            message: `Receita de ${formatBRL(newRecord.amount)} ('${newRecord.description}') registrada com sucesso em [${getWalletLabel(cleanWallet)}] para ${monthTitle}. Saldo acumulado atual no Saldo Mestre: ${formatBRL(wState.balance)}.`,
            filePath: targetFile,
            income: newRecord,
            totals,
            masterBalance: wState.balance,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao registrar receita financeira: ${msg}`,
          };
        }
      },
    }),

    record_expense: tool({
      description:
        "Registra um gasto ou despesa na nota mensal do cofre do Obsidian e debita o valor no 'saldo-mestre.md'. " +
        "Use wallet: 'conta_corrente' para gastos com dinheiro/débito/PIX; ou wallet: 'va' para despesas pagas no cartão de Vale Alimentação.",
      parameters: z.object({
        amount: z.number().positive().describe("Valor monetário do gasto em reais (ex: 18.50, 45, 120.00)."),
        description: z.string().describe("Descrição clara do gasto (ex: 'Almoço no restaurante', 'Supermercado', 'Transporte 99')."),
        category: z
          .string()
          .optional()
          .default("Diversos")
          .describe("Categoria do gasto (ex: 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Diversos')."),
        wallet: z
          .string()
          .optional()
          .default("conta_corrente")
          .describe("Carteira utilizada: 'conta_corrente' (pessoal/débito/PIX) ou 'va' (cartão de Vale Alimentação)."),
        date: z
          .string()
          .optional()
          .describe("Data do gasto no formato YYYY-MM-DD. Se omitida, usa a data atual."),
      }),
      execute: async ({ amount, description, category = "Diversos", wallet = "conta_corrente", date }) => {
        try {
          const now = new Date();
          const expenseDate =
            date && /^\d{4}-\d{2}-\d{2}$/.test(date)
              ? date
              : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

          const expenseTime = now.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          const { yearMonth, monthTitle } = parseMonthYear(expenseDate);
          const targetFile = path.join(financeDir, `${yearMonth}.md`);

          const validation = validateAllowedPath(targetFile, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          await fs.mkdir(financeDir, { recursive: true });

          let existingRecords: FinancialTransaction[] = [];
          try {
            const content = await fs.readFile(targetFile, "utf-8");
            existingRecords = extractMetadata(content);
          } catch {}

          const cleanCategory =
            category.trim().charAt(0).toUpperCase() + category.trim().slice(1).toLowerCase();
          const cleanWallet = wallet.trim().toLowerCase();

          const newRecord: FinancialTransaction = {
            id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "expense",
            wallet: cleanWallet,
            date: expenseDate,
            time: expenseTime,
            category: cleanCategory,
            description: description.trim(),
            amount: Math.round(amount * 100) / 100,
          };

          existingRecords.push(newRecord);

          const updatedAt = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
          const markdown = generateMarkdown(monthTitle, yearMonth, existingRecords, updatedAt, expenseDate);
          await fs.writeFile(targetFile, markdown, "utf-8");

          // Atualiza o Saldo Mestre
          const master = await readMasterBalance(financeDir, allowedPaths);
          const wState = master.wallets[cleanWallet] || {
            wallet: cleanWallet,
            label: getWalletLabel(cleanWallet),
            balanceCents: 0,
            balance: 0,
            lastUpdate: now.toISOString(),
          };

          wState.balanceCents -= Math.round(amount * 100);
          wState.balance = wState.balanceCents / 100;
          wState.lastUpdate = now.toISOString();
          wState.lastTransactionDescription = description.trim();
          wState.lastTransactionAmount = Math.round(amount * 100) / 100;
          wState.lastTransactionType = "expense";

          master.wallets[cleanWallet] = wState;
          await writeMasterBalance(financeDir, allowedPaths, master);

          const totals = calculateMonthlyTotals(existingRecords);
          const currentMonthWallet = totals.wallets[cleanWallet] || { totalExpense: newRecord.amount, balance: -newRecord.amount };
          const burn = analyzeBurnRate(yearMonth, currentMonthWallet.expenseCents, currentMonthWallet.incomeCents, expenseDate);

          let feedbackMsg = `Gasto de ${formatBRL(newRecord.amount)} ('${newRecord.description}') registrado em [${getWalletLabel(cleanWallet)}] para ${monthTitle}. Saldo atualizado no Saldo Mestre: ${formatBRL(wState.balance)}.`;
          if (burn.alert) {
            feedbackMsg += `\n${burn.alert}`;
          }

          return {
            success: true,
            message: feedbackMsg,
            filePath: targetFile,
            expense: newRecord,
            monthTotal: totals.totalExpense,
            totals,
            walletTotals: currentMonthWallet,
            masterBalance: wState.balance,
            burnRate: burn,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao registrar gasto financeiro: ${msg}`,
          };
        }
      },
    }),

    adjust_wallet_balance: tool({
      description:
        "Ajusta ou calibra manualmente o saldo atual de uma carteira no 'saldo-mestre.md'. " +
        "Use para conciliar o saldo com o valor real do aplicativo bancário ou cartão de benefícios quando houver divergências.",
      parameters: z.object({
        wallet: z
          .string()
          .optional()
          .default("conta_corrente")
          .describe("Identificador da carteira a ajustar ('conta_corrente' ou 'va')."),
        newBalance: z.number().describe("Novo saldo exato em reais para a carteira (ex: 748.85 ou 1739.47)."),
        reason: z
          .string()
          .optional()
          .default("Conciliação manual de saldo")
          .describe("Motivo ou justificativa do ajuste."),
      }),
      execute: async ({ wallet = "conta_corrente", newBalance, reason = "Conciliação manual de saldo" }) => {
        try {
          const cleanWallet = wallet.trim().toLowerCase();
          const master = await readMasterBalance(financeDir, allowedPaths);

          const wState = master.wallets[cleanWallet] || {
            wallet: cleanWallet,
            label: getWalletLabel(cleanWallet),
            balanceCents: 0,
            balance: 0,
            lastUpdate: new Date().toISOString(),
          };

          const oldBalance = wState.balance;
          wState.balanceCents = Math.round(newBalance * 100);
          wState.balance = wState.balanceCents / 100;
          wState.lastUpdate = new Date().toISOString();
          wState.lastTransactionDescription = reason.trim();
          wState.lastTransactionAmount = Math.round(newBalance * 100) / 100;
          wState.lastTransactionType = "adjustment";

          master.wallets[cleanWallet] = wState;
          await writeMasterBalance(financeDir, allowedPaths, master);

          return {
            success: true,
            message: `Saldo da carteira [${getWalletLabel(cleanWallet)}] ajustado com sucesso de ${formatBRL(oldBalance)} para ${formatBRL(wState.balance)} no Saldo Mestre. Motivo: ${reason}.`,
            wallet: cleanWallet,
            oldBalance,
            newBalance: wState.balance,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao ajustar saldo da carteira: ${msg}`,
          };
        }
      },
    }),

    cancel_last_transaction: tool({
      description:
        "Cancela ou desfaz o último lançamento financeiro adicionado (ou um específico por ID) na nota do mês e reverte o saldo no 'saldo-mestre.md'.",
      parameters: z.object({
        month: z
          .string()
          .optional()
          .describe("Mês no formato YYYY-MM (ex: '2026-10'). Se omitido, usa o mês atual."),
        transactionId: z
          .string()
          .optional()
          .describe("ID específico da transação a cancelar. Se omitido, desfaz a mais recente do mês."),
      }),
      execute: async ({ month, transactionId }) => {
        try {
          const now = new Date();
          const { yearMonth, monthTitle } = parseMonthYear(month);
          const targetFile = path.join(financeDir, `${yearMonth}.md`);

          const validation = validateAllowedPath(targetFile, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          let content = "";
          try {
            content = await fs.readFile(targetFile, "utf-8");
          } catch {
            return {
              success: false,
              error: `Nenhuma nota de finanças encontrada para ${monthTitle}.`,
            };
          }

          const records = extractMetadata(content);
          if (records.length === 0) {
            return {
              success: false,
              error: `Nenhuma transação encontrada para cancelar em ${monthTitle}.`,
            };
          }

          let removedTransaction: FinancialTransaction | undefined;
          let remainingRecords: FinancialTransaction[] = [];

          if (transactionId) {
            const index = records.findIndex((r) => r.id === transactionId);
            if (index === -1) {
              return {
                success: false,
                error: `Transação com ID '${transactionId}' não foi encontrada.`,
              };
            }
            removedTransaction = records[index];
            remainingRecords = records.filter((_, i) => i !== index);
          } else {
            removedTransaction = records[records.length - 1];
            remainingRecords = records.slice(0, -1);
          }

          const updatedAt = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
          const markdown = generateMarkdown(monthTitle, yearMonth, remainingRecords, updatedAt);
          await fs.writeFile(targetFile, markdown, "utf-8");

          // Reverte o saldo correspondente no Saldo Mestre
          const master = await readMasterBalance(financeDir, allowedPaths);
          const targetWalletKey = removedTransaction.wallet || "conta_corrente";
          const wState = master.wallets[targetWalletKey];

          if (wState) {
            const deltaCents = Math.round(removedTransaction.amount * 100);
            if (removedTransaction.type === "income") {
              wState.balanceCents -= deltaCents;
            } else {
              wState.balanceCents += deltaCents;
            }
            wState.balance = wState.balanceCents / 100;
            wState.lastUpdate = now.toISOString();
            wState.lastTransactionDescription = `Cancelamento de '${removedTransaction.description}'`;
            wState.lastTransactionAmount = removedTransaction.amount;
            wState.lastTransactionType = "adjustment";

            master.wallets[targetWalletKey] = wState;
            await writeMasterBalance(financeDir, allowedPaths, master);
          }

          const totals = calculateMonthlyTotals(remainingRecords);
          const typeLabel = removedTransaction.type === "income" ? "Receita" : "Despesa";
          const walletLabel = getWalletLabel(removedTransaction.wallet);

          return {
            success: true,
            message: `${typeLabel} de ${formatBRL(removedTransaction.amount)} ('${removedTransaction.description}') em [${walletLabel}] desfeita com sucesso em ${monthTitle}. Saldo revertido no Saldo Mestre para ${formatBRL(wState?.balance || 0)}.`,
            cancelledTransaction: removedTransaction,
            remainingCount: remainingRecords.length,
            totals,
            masterBalance: wState?.balance,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao cancelar transação: ${msg}`,
          };
        }
      },
    }),

    get_financial_summary: tool({
      description:
        "Consulta o extrato financeiro mensal no Obsidian e o 'saldo-mestre.md' com a posição atual de cada carteira em tempo real.",
      parameters: z.object({
        month: z
          .string()
          .optional()
          .describe("Mês no formato YYYY-MM (ex: '2026-10') ou nome do mês (ex: 'setembro'). Se omitido, consulta o mês atual."),
        category: z
          .string()
          .optional()
          .describe("Filtrar por uma categoria específica (ex: 'Alimentação', 'Transporte')."),
        wallet: z
          .string()
          .optional()
          .describe("Filtrar por carteira ('conta_corrente' ou 'va'). Se omitido, retorna todas as carteiras."),
      }),
      execute: async ({ month, category, wallet }) => {
        try {
          const resolved = resolveMonthQuery(month);
          const targetMonth = resolved.yearMonth || month;
          const { yearMonth, monthTitle } = parseMonthYear(targetMonth);
          const targetFile = path.join(financeDir, `${yearMonth}.md`);

          const validation = validateAllowedPath(targetFile, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          // Carrega sempre a posição em tempo real do Saldo Mestre
          const master = await readMasterBalance(financeDir, allowedPaths);

          let content = "";
          try {
            content = await fs.readFile(targetFile, "utf-8");
          } catch {
            return {
              success: true,
              message: `Nenhum registro de finanças encontrado para ${monthTitle}.`,
              monthTitle,
              totalAmount: formatBRL(0),
              totalIncome: formatBRL(0),
              totalExpense: formatBRL(0),
              balance: formatBRL(0),
              recordsCount: 0,
              masterBalances: master.wallets,
            };
          }

          const records = extractMetadata(content);
          if (records.length === 0) {
            return {
              success: true,
              message: `Nenhuma transação registrada em ${monthTitle}.`,
              monthTitle,
              totalAmount: formatBRL(0),
              totalIncome: formatBRL(0),
              totalExpense: formatBRL(0),
              balance: formatBRL(0),
              recordsCount: 0,
              masterBalances: master.wallets,
            };
          }

          const totals = calculateMonthlyTotals(records);
          const mainWallet = totals.wallets["conta_corrente"] || { expenseCents: 0, incomeCents: 0, dailyExpenseRate: 0 };
          const burn = analyzeBurnRate(yearMonth, mainWallet.expenseCents, mainWallet.incomeCents);

          const targetCat = category?.trim().toLowerCase();
          const targetWallet = (wallet || resolved.wallet)?.trim().toLowerCase();

          let filteredRecords = records;
          if (targetCat) {
            filteredRecords = filteredRecords.filter((r) => r.category.toLowerCase() === targetCat);
          }
          if (targetWallet) {
            filteredRecords = filteredRecords.filter((r) => r.wallet.toLowerCase() === targetWallet);
          }

          const filteredCents = filteredRecords.reduce(
            (acc, r) => acc + Math.round(r.amount * 100),
            0
          );

          const expCatMap = new Map<string, number>();
          for (const r of filteredRecords.filter((r) => r.type === "expense")) {
            expCatMap.set(
              r.category,
              (expCatMap.get(r.category) || 0) + Math.round(r.amount * 100)
            );
          }

          const expenseCategories = Array.from(expCatMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([cat, cents]) => ({
              category: cat,
              total: formatBRL(cents / 100),
            }));

          return {
            success: true,
            monthTitle,
            categoryFilter: category || null,
            walletFilter: targetWallet || null,
            totalAmount: formatBRL(totals.totalExpense),
            totalExpense: formatBRL(totals.totalExpense),
            totalIncome: formatBRL(totals.totalIncome),
            balance: formatBRL(totals.balance),
            wallets: totals.wallets,
            masterBalances: master.wallets,
            dailyBurnRate: formatBRL(burn.dailyExpenseRate),
            burnAlert: burn.alert || null,
            recordsCount: filteredRecords.length,
            filteredTotal: (category || targetWallet) ? formatBRL(filteredCents / 100) : null,
            expenseCategories,
            recentTransactions: filteredRecords.slice(-5).reverse(),
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao consultar resumo financeiro: ${msg}`,
          };
        }
      },
    }),
  };
}
