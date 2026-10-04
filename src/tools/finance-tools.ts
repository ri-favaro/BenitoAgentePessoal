import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { validateAllowedPath } from "./path-guard.js";

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: string;
  description: string;
  amount: number;
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

function parseMonthYear(dateStr?: string): { yearMonth: string; monthTitle: string } {
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

function extractMetadata(fileContent: string): ExpenseRecord[] {
  const match = fileContent.match(/<!-- METADATA:\s*([\s\S]*?)\s*-->/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateMarkdown(
  monthTitle: string,
  records: ExpenseRecord[],
  updatedAt: string
): string {
  // Cálculo exato usando centavos para evitar erros de ponto flutuante
  const totalCents = records.reduce(
    (acc, r) => acc + Math.round(r.amount * 100),
    0
  );
  const totalAmount = totalCents / 100;

  // Agrupamento por categoria
  const categoriesMap = new Map<string, { count: number; cents: number }>();
  for (const r of records) {
    const current = categoriesMap.get(r.category) || { count: 0, cents: 0 };
    current.count += 1;
    current.cents += Math.round(r.amount * 100);
    categoriesMap.set(r.category, current);
  }

  const sortedCategories = Array.from(categoriesMap.entries()).sort(
    (a, b) => b[1].cents - a[1].cents
  );

  let categoryTable = "| Categoria | Total | Qtd. |\n| :--- | :--- | :--- |\n";
  if (sortedCategories.length === 0) {
    categoryTable += "| *Nenhum gasto* | R$ 0,00 | 0 |\n";
  } else {
    for (const [cat, data] of sortedCategories) {
      categoryTable += `| ${cat} | ${formatBRL(data.cents / 100)} | ${data.count} |\n`;
    }
  }

  let transactionsTable =
    "| Data | Horário | Categoria | Descrição | Valor |\n| :--- | :--- | :--- | :--- | :--- |\n";
  if (records.length === 0) {
    transactionsTable += "| - | - | - | *Nenhuma transação* | - |\n";
  } else {
    // Lista as transações em ordem cronológica reversa (mais recentes no topo)
    const reversed = [...records].reverse();
    for (const r of reversed) {
      const [y, m, d] = r.date.split("-");
      const dateFormatted = `${d}/${m}/${y}`;
      transactionsTable += `| ${dateFormatted} | ${r.time} | ${r.category} | ${r.description} | ${formatBRL(r.amount)} |\n`;
    }
  }

  const metadataJson = JSON.stringify(records, null, 2);

  return `# 💰 Finanças - ${monthTitle}

> **Total Gasto no Mês:** ${formatBRL(totalAmount)}  
> **Última Atualização:** ${updatedAt}

---

## 📊 Gastos por Categoria

${categoryTable}
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
    record_expense: tool({
      description:
        "Registra um gasto ou despesa financeira na nota mensal do cofre do Obsidian (ex: G:\\CofreObsidian\\AgentePessoal\\Financas\\YYYY-MM.md). " +
        "Calcula automaticamente a somatória do mês e totais por categoria com precisão matemática. " +
        "NUNCA use save_memory para gastos: use EXCLUSIVAMENTE esta ferramenta.",
      parameters: z.object({
        amount: z.number().positive().describe("Valor monetário do gasto em reais (ex: 18.50, 45, 120.00)."),
        description: z.string().describe("Descrição clara do gasto (ex: 'Almoço no restaurante', 'Gasolina', 'Livro', 'Farmácia')."),
        category: z
          .string()
          .optional()
          .default("Diversos")
          .describe("Categoria do gasto (ex: 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Casa', 'Tecnologia', 'Diversos')."),
        date: z
          .string()
          .optional()
          .describe("Data do gasto no formato YYYY-MM-DD. Se não informada, usa a data atual local."),
      }),
      execute: async ({ amount, description, category = "Diversos", date }) => {
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

          // Validação de segurança via Path Guard
          const validation = validateAllowedPath(targetFile, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          await fs.mkdir(financeDir, { recursive: true });

          // Lê registros existentes se o arquivo já existir
          let existingRecords: ExpenseRecord[] = [];
          try {
            const content = await fs.readFile(targetFile, "utf-8");
            existingRecords = extractMetadata(content);
          } catch {
            // Arquivo não existe ainda para este mês
          }

          const cleanCategory =
            category.trim().charAt(0).toUpperCase() + category.trim().slice(1).toLowerCase();

          const newRecord: ExpenseRecord = {
            id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            date: expenseDate,
            time: expenseTime,
            category: cleanCategory,
            description: description.trim(),
            amount: Math.round(amount * 100) / 100,
          };

          existingRecords.push(newRecord);

          const updatedAt = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
          const markdown = generateMarkdown(monthTitle, existingRecords, updatedAt);

          await fs.writeFile(targetFile, markdown, "utf-8");

          const totalCents = existingRecords.reduce(
            (acc, r) => acc + Math.round(r.amount * 100),
            0
          );

          return {
            success: true,
            message: `Gasto de ${formatBRL(newRecord.amount)} ('${newRecord.description}') registrado com sucesso na categoria '${cleanCategory}' em ${monthTitle}. Total acumulado no mês: ${formatBRL(totalCents / 100)}.`,
            filePath: targetFile,
            expense: newRecord,
            monthTotal: totalCents / 100,
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

    get_financial_summary: tool({
      description:
        "Consulta os gastos financeiros registrados no cofre do Obsidian para um mês específico ou mês atual. " +
        "Retorna o total gasto, totais por categoria e as transações mais recentes.",
      parameters: z.object({
        month: z
          .string()
          .optional()
          .describe("Mês no formato YYYY-MM (ex: '2026-10'). Se omitido, consulta o mês atual."),
        category: z
          .string()
          .optional()
          .describe("Filtrar por uma categoria específica (ex: 'Alimentação', 'Transporte')."),
      }),
      execute: async ({ month, category }) => {
        try {
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
              success: true,
              message: `Nenhum registro de gastos encontrado para ${monthTitle}.`,
              monthTitle,
              totalAmount: 0,
              recordsCount: 0,
            };
          }

          const records = extractMetadata(content);
          if (records.length === 0) {
            return {
              success: true,
              message: `Nenhum gasto registrado em ${monthTitle}.`,
              monthTitle,
              totalAmount: 0,
              recordsCount: 0,
            };
          }

          const targetCat = category?.trim().toLowerCase();
          const filteredRecords = targetCat
            ? records.filter((r) => r.category.toLowerCase() === targetCat)
            : records;

          const totalCents = filteredRecords.reduce(
            (acc, r) => acc + Math.round(r.amount * 100),
            0
          );
          const totalAmount = totalCents / 100;

          // Totais por categoria
          const catMap = new Map<string, number>();
          for (const r of records) {
            catMap.set(
              r.category,
              (catMap.get(r.category) || 0) + Math.round(r.amount * 100)
            );
          }

          const categoriesSummary = Array.from(catMap.entries()).map(
            ([cat, cents]) => ({
              category: cat,
              total: formatBRL(cents / 100),
            })
          );

          return {
            success: true,
            monthTitle,
            categoryFilter: category || null,
            totalAmount: formatBRL(totalAmount),
            recordsCount: filteredRecords.length,
            categoriesSummary,
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
