import { tool } from "ai";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { validateAllowedPath } from "./path-guard.js";

export function createFilesystemTools(
  allowedPaths: string[] = config.filesystem.allowedPaths
) {
  return {
    write_file: tool({
      description:
        "Cria ou sobrescreve um arquivo de texto no computador (ex: notas .md no Obsidian, arquivos de código, etc.). " +
        "SEGURANÇA: Só é permitido escrever dentro dos diretórios autorizados. " +
        "Cria as pastas automaticamente se não existirem.",
      parameters: z.object({
        filePath: z
          .string()
          .describe(
            "Caminho do arquivo (ex: 'G:\\CofreObsidian\\AgentePessoal\\nota.md' ou relativo ao projeto)."
          ),
        content: z.string().describe("O conteúdo em texto/markdown a ser escrito no arquivo."),
      }),
      execute: async ({ filePath, content }) => {
        try {
          const validation = validateAllowedPath(filePath, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          const resolvedPath = validation.resolvedPath;
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
      description:
        "Lê o conteúdo de um arquivo de texto no computador. " +
        "SEGURANÇA: Só é permitido ler arquivos dentro dos diretórios autorizados.",
      parameters: z.object({
        filePath: z.string().describe("Caminho do arquivo a ser lido."),
      }),
      execute: async ({ filePath }) => {
        try {
          const validation = validateAllowedPath(filePath, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          const resolvedPath = validation.resolvedPath;
          const content = await fs.readFile(resolvedPath, "utf-8");
          return {
            success: true,
            filePath: resolvedPath,
            content,
            message: `Arquivo lido com sucesso: ${path.basename(resolvedPath)} (${content.length} caracteres).`,
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
      description:
        "Lista os arquivos e subpastas de um diretório no computador. " +
        "SEGURANÇA: Só é permitido listar pastas dentro dos diretórios autorizados.",
      parameters: z.object({
        dirPath: z.string().describe("Caminho da pasta a ser listada."),
      }),
      execute: async ({ dirPath }) => {
        try {
          const validation = validateAllowedPath(dirPath, allowedPaths);
          if (!validation.allowed) {
            return {
              success: false,
              error: validation.error,
            };
          }

          const resolvedPath = validation.resolvedPath;
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
