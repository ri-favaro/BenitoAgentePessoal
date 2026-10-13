import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { validateAllowedPath } from "./path-guard.js";

export interface VaultTask {
  file: string;
  relativePath: string;
  line: number;
  status: "open" | "completed";
  text: string;
  rawLine: string;
}

export type DailySection = "notas" | "tarefas" | "financas" | "aprendizados" | "geral";

const SECTION_HEADERS: Record<Exclude<DailySection, "geral">, string> = {
  notas: "## 📝 Notas & Decisões",
  tarefas: "## ✅ Tarefas & Pendências",
  financas: "## 💰 Finanças & Gastos",
  aprendizados: "## 💡 Aprendizados & Insights",
};

/**
 * Gera o template inicial padronizado para uma nova Daily Note.
 */
export function buildInitialDailyNoteContent(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(year, (month || 1) - 1, day || 1);
  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const capitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return `# 📅 ${capitalized} (${dateStr})\n\n${SECTION_HEADERS.notas}\n\n${SECTION_HEADERS.tarefas}\n\n${SECTION_HEADERS.financas}\n\n${SECTION_HEADERS.aprendizados}\n`;
}

/**
 * Insere conteúdo dentro de uma seção específica de um documento Markdown.
 */
export function insertContentIntoSection(
  currentMarkdown: string,
  section: DailySection,
  contentToAdd: string
): string {
  const cleanContent = contentToAdd.trim();
  if (!cleanContent) return currentMarkdown;

  if (section === "geral") {
    return currentMarkdown.trimEnd() + "\n\n" + cleanContent + "\n";
  }

  const targetHeader = SECTION_HEADERS[section];
  const headerIndex = currentMarkdown.indexOf(targetHeader);

  if (headerIndex === -1) {
    // Se a seção não existir no arquivo, adiciona no final
    return currentMarkdown.trimEnd() + "\n\n" + targetHeader + "\n\n" + cleanContent + "\n";
  }

  // Localiza o início da próxima seção (próximo ## )
  const afterHeader = headerIndex + targetHeader.length;
  const nextSectionMatch = currentMarkdown.slice(afterHeader).match(/\n## /);

  if (nextSectionMatch && nextSectionMatch.index !== undefined) {
    const insertPos = afterHeader + nextSectionMatch.index;
    const beforeNext = currentMarkdown.slice(0, insertPos).trimEnd();
    const afterNext = currentMarkdown.slice(insertPos);
    return beforeNext + "\n" + cleanContent + "\n\n" + afterNext.trimStart();
  }

  // Se for a última seção do documento
  return currentMarkdown.trimEnd() + "\n" + cleanContent + "\n";
}

/**
 * Varre recursivamente arquivos .md em um diretório ignorando pastas de sistema.
 */
async function scanMarkdownFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name.startsWith(".") ||
      entry.name === "node_modules" ||
      entry.name === ".obsidian" ||
      entry.name === ".trash"
    ) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await scanMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
}

export function createObsidianTools(
  vaultPath: string,
  dailyNotesDir: string,
  allowedPaths: string[] = [vaultPath]
) {
  return {
    append_daily_note: tool({
      description:
        "Adiciona uma entrada (nota, decisão, tarefa, gasto ou aprendizado) na Daily Note do dia no cofre do Obsidian. Se a nota diária ainda não existir, cria o arquivo com a estrutura padronizada de seções.",
      parameters: z.object({
        content: z
          .string()
          .describe("Texto a ser registrado na Daily Note (suporta Markdown)."),
        section: z
          .enum(["notas", "tarefas", "financas", "aprendizados", "geral"])
          .optional()
          .default("notas")
          .describe(
            "Seção onde inserir a entrada: 'notas' (Notas & Decisões), 'tarefas' (Tarefas & Pendências), 'financas' (Finanças & Gastos), 'aprendizados' (Aprendizados & Insights) ou 'geral'."
          ),
        date: z
          .string()
          .optional()
          .describe(
            "Data da nota diária no formato YYYY-MM-DD. Se omitida, utiliza a data de hoje."
          ),
      }),
      execute: async ({ content, section = "notas", date }) => {
        try {
          const targetDate = date || new Date().toISOString().slice(0, 10);
          const targetFile = path.join(dailyNotesDir, `${targetDate}.md`);

          const check = validateAllowedPath(targetFile, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          await fs.mkdir(dailyNotesDir, { recursive: true });

          let currentContent = "";
          let fileExists = false;

          try {
            currentContent = await fs.readFile(targetFile, "utf-8");
            fileExists = true;
          } catch {
            currentContent = buildInitialDailyNoteContent(targetDate);
          }

          let formattedContent = content.trim();
          if (section === "tarefas") {
            // Garante que cada linha seja um item de checkbox Markdown
            formattedContent = formattedContent
              .split("\n")
              .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return "";
                if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
                  return trimmed;
                }
                return `- [ ] ${trimmed.replace(/^[-*•]\s*/, "")}`;
              })
              .filter(Boolean)
              .join("\n");
          } else if (!formattedContent.startsWith("-") && !formattedContent.startsWith("•")) {
            formattedContent = `• ${formattedContent}`;
          }

          const updated = insertContentIntoSection(currentContent, section, formattedContent);
          await fs.writeFile(targetFile, updated, "utf-8");

          return {
            success: true,
            filePath: targetFile,
            date: targetDate,
            section,
            created: !fileExists,
            message: `Registro adicionado com sucesso na Daily Note de ${targetDate} (seção: ${section}).`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha ao atualizar Daily Note: ${msg}` };
        }
      },
    }),

    get_daily_note: tool({
      description:
        "Consulta e retorna o conteúdo completo da Daily Note de uma data específica no cofre do Obsidian.",
      parameters: z.object({
        date: z
          .string()
          .optional()
          .describe("Data da Daily Note no formato YYYY-MM-DD. Se omitida, busca a nota de hoje."),
      }),
      execute: async ({ date }) => {
        try {
          const targetDate = date || new Date().toISOString().slice(0, 10);
          const targetFile = path.join(dailyNotesDir, `${targetDate}.md`);

          const check = validateAllowedPath(targetFile, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          try {
            const content = await fs.readFile(targetFile, "utf-8");
            return {
              success: true,
              exists: true,
              date: targetDate,
              filePath: targetFile,
              content,
            };
          } catch {
            return {
              success: true,
              exists: false,
              date: targetDate,
              filePath: targetFile,
              content: "",
              message: `Nenhuma Daily Note encontrada para a data ${targetDate}.`,
            };
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Erro ao consultar Daily Note: ${msg}` };
        }
      },
    }),

    list_vault_tasks: tool({
      description:
        "Escaneia as notas do cofre do Obsidian e lista todas as tarefas/checkboxes (- [ ] ou - [x]), permitindo filtrar por status (abertas/concluídas) e subpasta.",
      parameters: z.object({
        status: z
          .enum(["open", "completed", "all"])
          .optional()
          .default("open")
          .describe("Filtro de tarefas: 'open' (apenas abertas), 'completed' (apenas concluídas) ou 'all'."),
        folder: z
          .string()
          .optional()
          .describe(
            "Subpasta opcional para restringir a busca (ex: 'Daily Notes' ou 'notas'). Se omitida, escaneia todo o cofre."
          ),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Número máximo de tarefas a retornar (padrão: 50)."),
      }),
      execute: async ({ status = "open", folder, limit = 50 }) => {
        try {
          const searchDir = folder ? path.resolve(vaultPath, folder) : vaultPath;
          const check = validateAllowedPath(searchDir, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          try {
            await fs.access(searchDir);
          } catch {
            return {
              success: true,
              totalFound: 0,
              tasks: [],
              summary: `Diretório '${folder || "cofre"}' não encontrado ou vazio.`,
            };
          }

          const files = await scanMarkdownFiles(searchDir);
          const tasks: VaultTask[] = [];

          for (const file of files) {
            const content = await fs.readFile(file, "utf-8");
            const lines = content.split("\n");
            const relPath = path.relative(vaultPath, file);

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const match = line.match(/^(\s*[-*]\s*)\[([ xX])\]\s*(.*)$/);
              if (match) {
                const isCompleted = match[2].toLowerCase() === "x";
                const taskStatus: "open" | "completed" = isCompleted ? "completed" : "open";

                if (
                  status === "all" ||
                  (status === "open" && !isCompleted) ||
                  (status === "completed" && isCompleted)
                ) {
                  tasks.push({
                    file,
                    relativePath: relPath,
                    line: i + 1,
                    status: taskStatus,
                    text: match[3].trim(),
                    rawLine: line,
                  });
                }
              }
            }
          }

          const limitedTasks = tasks.slice(0, limit);
          const summaryLines = limitedTasks.map((t) => {
            const mark = t.status === "completed" ? "✔" : "⬜";
            return `${mark} **[${t.relativePath}]** ${t.text}`;
          });

          const summary =
            limitedTasks.length > 0
              ? `📋 **Tarefas Encontradas (${limitedTasks.length}/${tasks.length}):**\n\n` +
                summaryLines.join("\n")
              : "Nenhuma tarefa encontrada para os critérios especificados.";

          return {
            success: true,
            totalFound: tasks.length,
            tasks: limitedTasks,
            summary,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Erro ao listar tarefas do cofre: ${msg}` };
        }
      },
    }),

    toggle_vault_task: tool({
      description:
        "Alterna o estado de uma tarefa/checkbox no Obsidian (marcando como concluída - [x] ou desmarcando para - [ ]).",
      parameters: z.object({
        filePath: z
          .string()
          .describe("Caminho do arquivo (relativo ao cofre ou absoluto) onde a tarefa está localizada."),
        taskText: z
          .string()
          .describe("Texto ou trecho da tarefa a ser alternada."),
        completed: z
          .boolean()
          .describe("true para marcar como concluída (- [x]), false para reabrir (- [ ])."),
      }),
      execute: async ({ filePath, taskText, completed }) => {
        try {
          const targetFile = path.isAbsolute(filePath)
            ? path.resolve(filePath)
            : path.resolve(vaultPath, filePath);

          const check = validateAllowedPath(targetFile, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          const content = await fs.readFile(targetFile, "utf-8");
          const lines = content.split("\n");
          let foundIndex = -1;
          const searchClean = taskText.trim().toLowerCase();

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (
              (line.includes("- [ ]") || line.includes("- [x]") || line.includes("- [X]")) &&
              line.toLowerCase().includes(searchClean)
            ) {
              foundIndex = i;
              break;
            }
          }

          if (foundIndex === -1) {
            return {
              success: false,
              error: `Tarefa contendo "${taskText}" não foi encontrada no arquivo ${path.basename(targetFile)}.`,
            };
          }

          const oldLine = lines[foundIndex];
          const newBox = completed ? "- [x]" : "- [ ]";
          const updatedLine = oldLine.replace(/[-*]\s*\[[ xX]\]/, newBox);
          lines[foundIndex] = updatedLine;

          await fs.writeFile(targetFile, lines.join("\n"), "utf-8");

          return {
            success: true,
            filePath: targetFile,
            line: foundIndex + 1,
            completed,
            updatedLine,
            message: `Tarefa ${completed ? "marcada como concluída" : "reaberta"} com sucesso.`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Erro ao alternar tarefa: ${msg}` };
        }
      },
    }),

    suggest_vault_links: tool({
      description:
        "Analisa um texto ou nota e sugere conexões semânticas com links bidirecionais ([[WikiLinks]]) baseando-se nas notas existentes no cofre do Obsidian.",
      parameters: z.object({
        text: z.string().describe("Texto ou parágrafo a ser analisado para sugestão de wikilinks."),
        autoInject: z
          .boolean()
          .optional()
          .default(false)
          .describe("Se true, retorna o texto original com os [[WikiLinks]] já injetados nas menções correspondentes."),
      }),
      execute: async ({ text, autoInject = false }) => {
        try {
          const check = validateAllowedPath(vaultPath, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          const files = await scanMarkdownFiles(vaultPath);
          const noteNames = files.map((f) => {
            const base = path.basename(f, ".md");
            return {
              name: base,
              file: f,
              relativePath: path.relative(vaultPath, f),
            };
          });

          // Filtra nomes com mais de 3 caracteres para evitar falsos positivos comuns
          const candidates = noteNames.filter((n) => n.name.length >= 3);
          const linksFound: string[] = [];
          let modifiedText = text;

          for (const candidate of candidates) {
            // Regex que procura o título como palavra inteira e não envolvida por [[ ]]
            const escaped = candidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(`(?<!\\[\\[)\\b(${escaped})\\b(?!\\]\\])`, "i");

            if (pattern.test(modifiedText)) {
              linksFound.push(candidate.name);
              if (autoInject) {
                modifiedText = modifiedText.replace(pattern, `[[${candidate.name}]]`);
              }
            }
          }

          return {
            success: true,
            totalNotesInVault: noteNames.length,
            linksFound,
            count: linksFound.length,
            suggestedText: modifiedText,
            message:
              linksFound.length > 0
                ? `Encontradas ${linksFound.length} notas no cofre para conexão bidirecional: ${linksFound.map((l) => `[[${l}]]`).join(", ")}.`
                : "Nenhuma correspondência com notas existentes encontrada no texto.",
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Erro ao sugerir links do cofre: ${msg}` };
        }
      },
    }),
  };
}
