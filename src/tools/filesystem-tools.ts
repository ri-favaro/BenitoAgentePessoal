import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

export function createFilesystemTools() {
  return {
    write_file: tool({
      description:
        "Cria ou sobrescreve um arquivo de texto no computador (por exemplo, notas .md no Obsidian, arquivos de código, etc.). Cria as pastas automaticamente se não existirem.",
      parameters: z.object({
        filePath: z
          .string()
          .describe(
            "Caminho completo do arquivo (ex: 'G:\\CofreObsidian\\AgentePessoal\\nota.md' ou relativo)."
          ),
        content: z.string().describe("O conteúdo em texto/markdown a ser escrito no arquivo."),
      }),
      execute: async ({ filePath, content }) => {
        try {
          const resolvedPath = path.resolve(filePath);
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, content, "utf-8");
          return {
            success: true,
            message: `Arquivo salvo com sucesso em: ${resolvedPath}`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao escrever arquivo: ${msg}`,
          };
        }
      },
    }),

    read_file: tool({
      description: "Lê o conteúdo de um arquivo de texto no computador.",
      parameters: z.object({
        filePath: z.string().describe("Caminho do arquivo a ser lido."),
      }),
      execute: async ({ filePath }) => {
        try {
          const resolvedPath = path.resolve(filePath);
          const content = await fs.readFile(resolvedPath, "utf-8");
          return {
            success: true,
            filePath: resolvedPath,
            content,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao ler arquivo: ${msg}`,
          };
        }
      },
    }),

    list_directory: tool({
      description: "Lista os arquivos e subpastas de um diretório no computador.",
      parameters: z.object({
        dirPath: z.string().describe("Caminho da pasta a ser listada."),
      }),
      execute: async ({ dirPath }) => {
        try {
          const resolvedPath = path.resolve(dirPath);
          const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
          const items = entries.map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? "pasta" : "arquivo",
          }));
          return {
            success: true,
            directory: resolvedPath,
            items,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: `Erro ao listar diretório: ${msg}`,
          };
        }
      },
    }),
  };
}
