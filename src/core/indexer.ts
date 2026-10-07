import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { EmbeddingService } from "./embedding-service.js";
import {
  VectorStore,
  type CodeChunkRecord,
  type VaultChunkRecord,
} from "./vector-store.js";
import { isPathInside } from "../tools/path-guard.js";
import { config } from "../config.js";

export interface IndexSummary {
  target: "codebase" | "vault" | "all";
  totalScanned: number;
  filesIndexed: number;
  filesSkipped: number;
  filesDeleted: number;
  chunksCreated: number;
  durationMs: number;
}

const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".lancedb",
  ".models",
  ".next",
  "coverage",
  ".vscode",
  ".idea",
  "bin",
  "obj",
  "logs",
  "scratch",
  ".turbo",
  "out",
  ".cache",
  "tmp",
  "temp",
]);

const SUPPORTED_CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".sql",
  ".py",
  ".md",
  ".env.example",
  ".yml",
  ".yaml",
  ".html",
  ".css",
  ".sh",
  ".ps1",
]);

export class KnowledgeIndexer {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;

  constructor(embeddingService: EmbeddingService, vectorStore: VectorStore) {
    this.embeddingService = embeddingService;
    this.vectorStore = vectorStore;
  }

  /**
   * Indexa todos os repositórios/diretórios autorizados em ALLOWED_DIRECTORIES.
   */
  async indexCodebase(allowedDirs: string[]): Promise<IndexSummary> {
    const startTime = Date.now();
    let totalScanned = 0;
    let filesIndexed = 0;
    let filesSkipped = 0;
    let chunksCreated = 0;

    const storedHashes = await this.vectorStore.getStoredHashes("codebase");
    const scannedRelativePaths = new Set<string>();
    const pendingChunks: CodeChunkRecord[] = [];
    const resolvedVault = path.resolve(config.finance.vaultPath).toLowerCase();

    for (const dir of allowedDirs) {
      const resolvedDir = path.resolve(dir);
      // Evita indexar o cofre do Obsidian como codebase se ele estiver em ALLOWED_DIRECTORIES
      if (resolvedDir.toLowerCase() === resolvedVault) {
        continue;
      }

      const projectName = path.basename(resolvedDir);

      try {
        const filePaths = await this.scanDirectory(resolvedDir, (f) => {
          const ext = path.extname(f).toLowerCase();
          const base = path.basename(f).toLowerCase();
          if (
            base === "package-lock.json" ||
            base === "yarn.lock" ||
            base === "pnpm-lock.yaml" ||
            base.endsWith(".tsbuildinfo")
          ) {
            return false;
          }
          return SUPPORTED_CODE_EXTENSIONS.has(ext);
        });

        for (const filePath of filePaths) {
          totalScanned++;
          const relativePath = `${projectName}/${path.relative(resolvedDir, filePath).replace(/\\/g, "/")}`;
          scannedRelativePaths.add(relativePath);

          let content: string;
          try {
            content = await fs.readFile(filePath, "utf-8");
          } catch {
            continue;
          }

          // Ignora arquivos vazios ou excessivamente grandes (> 150KB) que costumam ser bundles/dumps
          if (!content.trim() || content.length > 150000) {
            filesSkipped++;
            continue;
          }

          const hash = this.computeHash(content);
          if (storedHashes.get(relativePath) === hash) {
            filesSkipped++;
            continue;
          }

          // Divide o arquivo em chunks
          const fileChunks = this.chunkCodeFile({
            filePath,
            relativePath,
            projectName,
            content,
            hash,
          });

          pendingChunks.push(...fileChunks);
          filesIndexed++;
        }
      } catch (err) {
        console.error(`[Indexer] Erro ao escanear diretório '${resolvedDir}':`, err);
      }
    }

    // Calcula embeddings em lote se houver chunks pendentes
    if (pendingChunks.length > 0) {
      const texts = pendingChunks.map(
        (c) => `// File: ${c.relativePath} (lines ${c.startLine}-${c.endLine})\n${c.content}`
      );
      const embeddings = await this.embeddingService.getBatchEmbeddings(texts);

      for (let i = 0; i < pendingChunks.length; i++) {
        pendingChunks[i].vector = embeddings[i] || [];
      }

      const validChunks = pendingChunks.filter((c) => c.vector.length > 0);
      if (validChunks.length > 0) {
        await this.vectorStore.upsertCodebaseChunks(validChunks);
      }
      chunksCreated = validChunks.length;
    }

    // Identifica e remove arquivos que foram excluídos do disco
    const filesToDelete: string[] = [];
    for (const storedPath of storedHashes.keys()) {
      if (!scannedRelativePaths.has(storedPath)) {
        filesToDelete.push(storedPath);
      }
    }

    if (filesToDelete.length > 0) {
      await this.vectorStore.deleteByRelativePaths("codebase", filesToDelete);
    }

    return {
      target: "codebase",
      totalScanned,
      filesIndexed,
      filesSkipped,
      filesDeleted: filesToDelete.length,
      chunksCreated,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Indexa notas do cofre do Obsidian.
   */
  async indexVault(vaultPath: string): Promise<IndexSummary> {
    const startTime = Date.now();
    let totalScanned = 0;
    let filesIndexed = 0;
    let filesSkipped = 0;
    let chunksCreated = 0;

    const resolvedVault = path.resolve(vaultPath);
    const storedHashes = await this.vectorStore.getStoredHashes("vault");
    const scannedRelativePaths = new Set<string>();
    const pendingChunks: VaultChunkRecord[] = [];

    try {
      const filePaths = await this.scanDirectory(resolvedVault, (f) => {
        const ext = path.extname(f).toLowerCase();
        return ext === ".md" || ext === ".txt" || ext === ".canvas";
      });

      for (const filePath of filePaths) {
        totalScanned++;
        const relativePath = path.relative(resolvedVault, filePath).replace(/\\/g, "/");
        scannedRelativePaths.add(relativePath);

        let content: string;
        try {
          content = await fs.readFile(filePath, "utf-8");
        } catch {
          continue;
        }

        if (!content.trim()) continue;

        const hash = this.computeHash(content);
        if (storedHashes.get(relativePath) === hash) {
          filesSkipped++;
          continue;
        }

        const noteChunks = this.chunkMarkdownFile({
          vaultPath: resolvedVault,
          filePath,
          relativePath,
          content,
          hash,
        });

        pendingChunks.push(...noteChunks);
        filesIndexed++;
      }
    } catch (err) {
      console.error(`[Indexer] Erro ao escanear cofre '${resolvedVault}':`, err);
    }

    if (pendingChunks.length > 0) {
      const texts = pendingChunks.map(
        (c) => `# ${c.title} > ${c.heading}\n\n${c.content}`
      );
      const embeddings = await this.embeddingService.getBatchEmbeddings(texts);

      for (let i = 0; i < pendingChunks.length; i++) {
        pendingChunks[i].vector = embeddings[i] || [];
      }

      const validChunks = pendingChunks.filter((c) => c.vector.length > 0);
      if (validChunks.length > 0) {
        await this.vectorStore.upsertVaultChunks(validChunks);
      }
      chunksCreated = validChunks.length;
    }

    const filesToDelete: string[] = [];
    for (const storedPath of storedHashes.keys()) {
      if (!scannedRelativePaths.has(storedPath)) {
        filesToDelete.push(storedPath);
      }
    }

    if (filesToDelete.length > 0) {
      await this.vectorStore.deleteByRelativePaths("vault", filesToDelete);
    }

    return {
      target: "vault",
      totalScanned,
      filesIndexed,
      filesSkipped,
      filesDeleted: filesToDelete.length,
      chunksCreated,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Chunking para arquivos de código.
   * Arquivos <= 60 linhas e <= 2200 caracteres viram 1 único chunk.
   * Arquivos maiores são divididos em janelas semânticas de 60 linhas com overlap de 15 linhas,
   * respeitando limite estrito de 2400 caracteres por chunk para prevenir estouro de tokens físicos.
   */
  chunkCodeFile(params: {
    filePath: string;
    relativePath: string;
    projectName: string;
    content: string;
    hash: string;
  }): CodeChunkRecord[] {
    const lines = params.content.split(/\r?\n/);
    const totalLines = lines.length;
    const ext = path.extname(params.filePath).replace(".", "") || "text";
    const chunks: CodeChunkRecord[] = [];
    const now = Date.now();

    if (totalLines <= 60 && params.content.length <= 2200) {
      chunks.push({
        id: `${params.relativePath}:1-${totalLines}`,
        vector: [],
        project: params.projectName,
        filePath: params.filePath,
        relativePath: params.relativePath,
        startLine: 1,
        endLine: totalLines,
        language: ext,
        content: params.content,
        contentHash: params.hash,
        updatedAt: now,
      });
      return chunks;
    }

    const lineWindow = 60;
    const overlap = 15;
    const maxChars = 2400;
    let start = 0;

    while (start < totalLines) {
      let end = Math.min(start + lineWindow, totalLines);
      let chunkLines = lines.slice(start, end);
      let text = chunkLines.join("\n");

      // Reduz linhas progressivamente se o bloco for muito denso em caracteres
      while (text.length > maxChars && end > start + 10) {
        end -= 5;
        chunkLines = lines.slice(start, end);
        text = chunkLines.join("\n");
      }

      // Trava de segurança para linhas gigantescas ou código minificado
      if (text.length > 2800) {
        text = text.slice(0, 2800);
      }

      chunks.push({
        id: `${params.relativePath}:${start + 1}-${end}`,
        vector: [],
        project: params.projectName,
        filePath: params.filePath,
        relativePath: params.relativePath,
        startLine: start + 1,
        endLine: end,
        language: ext,
        content: text,
        contentHash: params.hash,
        updatedAt: now,
      });

      if (end >= totalLines) break;
      start = Math.max(start + 1, end - overlap);
    }

    return chunks;
  }

  /**
   * Chunking para notas Markdown (Obsidian).
   * Divide por seções de cabeçalhos (#, ##, ###) com limite estrito de caracteres.
   */
  chunkMarkdownFile(params: {
    vaultPath: string;
    filePath: string;
    relativePath: string;
    content: string;
    hash: string;
  }): VaultChunkRecord[] {
    const title = path.basename(params.filePath, path.extname(params.filePath));
    const lines = params.content.split(/\r?\n/);
    const chunks: VaultChunkRecord[] = [];
    const now = Date.now();

    const sections: { heading: string; lines: string[] }[] = [];
    let currentHeading = "Introdução";
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({ heading: currentHeading, lines: currentLines });
          currentLines = [];
        }
        currentHeading = headingMatch[2].trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({ heading: currentHeading, lines: currentLines });
    }

    let chunkIdx = 0;
    const maxLinesPerChunk = 60;
    const overlap = 15;
    const maxChars = 2400;

    for (const section of sections) {
      const sLines = section.lines;
      const sHeading = section.heading;
      const fullSectionText = sLines.join("\n").trim();
      if (!fullSectionText) continue;

      if (sLines.length <= maxLinesPerChunk && fullSectionText.length <= maxChars) {
        chunks.push({
          id: `${params.relativePath}:sec-${chunkIdx++}`,
          vector: [],
          vaultPath: params.vaultPath,
          relativePath: params.relativePath,
          title,
          heading: sHeading,
          content: fullSectionText,
          contentHash: params.hash,
          updatedAt: now,
        });
      } else {
        // Seção longa dividida em sub-janelas seguras
        let sStart = 0;
        while (sStart < sLines.length) {
          let sEnd = Math.min(sStart + maxLinesPerChunk, sLines.length);
          let subLines = sLines.slice(sStart, sEnd);
          let subText = subLines.join("\n").trim();

          while (subText.length > maxChars && sEnd > sStart + 5) {
            sEnd -= 5;
            subLines = sLines.slice(sStart, sEnd);
            subText = subLines.join("\n").trim();
          }

          if (subText.length > 2800) {
            subText = subText.slice(0, 2800);
          }

          if (subText) {
            chunks.push({
              id: `${params.relativePath}:sec-${chunkIdx++}`,
              vector: [],
              vaultPath: params.vaultPath,
              relativePath: params.relativePath,
              title,
              heading: `${sHeading} (${sStart + 1}-${sEnd})`,
              content: subText,
              contentHash: params.hash,
              updatedAt: now,
            });
          }
          if (sEnd >= sLines.length) break;
          sStart = Math.max(sStart + 1, sEnd - overlap);
        }
      }
    }

    return chunks;
  }

  private computeHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async scanDirectory(
    dir: string,
    fileFilter: (filePath: string) => boolean
  ): Promise<string[]> {
    const results: string[] = [];

    async function walk(currentDir: string) {
      let entries: any[] = [];
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (!DEFAULT_IGNORED_DIRS.has(entry.name.toLowerCase())) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (fileFilter(fullPath)) {
            results.push(fullPath);
          }
        }
      }
    }

    await walk(dir);
    return results;
  }
}
