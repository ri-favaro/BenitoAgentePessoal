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

    for (const dir of allowedDirs) {
      const resolvedDir = path.resolve(dir);
      const projectName = path.basename(resolvedDir);

      try {
        const filePaths = await this.scanDirectory(resolvedDir, (f) => {
          const ext = path.extname(f).toLowerCase();
          const base = path.basename(f);
          if (base === "package-lock.json" || base === "yarn.lock" || base === "pnpm-lock.yaml") {
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

          // Ignora arquivos vazios
          if (!content.trim()) continue;

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

      await this.vectorStore.upsertCodebaseChunks(pendingChunks);
      chunksCreated = pendingChunks.length;
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

      await this.vectorStore.upsertVaultChunks(pendingChunks);
      chunksCreated = pendingChunks.length;
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
   * Arquivos <= 300 linhas viram 1 único chunk (aproveitando 8k ctx).
   * Arquivos maiores são divididos em janelas de 200 linhas com sobreposição de 40 linhas.
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

    if (totalLines <= 300) {
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

    const chunkSize = 200;
    const overlap = 40;
    let start = 0;

    while (start < totalLines) {
      const end = Math.min(start + chunkSize, totalLines);
      const chunkLines = lines.slice(start, end);
      const chunkContent = chunkLines.join("\n");

      chunks.push({
        id: `${params.relativePath}:${start + 1}-${end}`,
        vector: [],
        project: params.projectName,
        filePath: params.filePath,
        relativePath: params.relativePath,
        startLine: start + 1,
        endLine: end,
        language: ext,
        content: chunkContent,
        contentHash: params.hash,
        updatedAt: now,
      });

      if (end >= totalLines) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Chunking para notas Markdown (Obsidian).
   * Divide por seções de cabeçalhos (#, ##, ###).
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

    // Se o arquivo tiver poucas seções ou nenhuma divisão explícita
    if (sections.length <= 1) {
      chunks.push({
        id: `${params.relativePath}:all`,
        vector: [],
        vaultPath: params.vaultPath,
        relativePath: params.relativePath,
        title,
        heading: "Completo",
        content: params.content,
        contentHash: params.hash,
        updatedAt: now,
      });
      return chunks;
    }

    let chunkIdx = 0;
    for (const section of sections) {
      const sectionContent = section.lines.join("\n").trim();
      if (!sectionContent) continue;

      chunks.push({
        id: `${params.relativePath}:sec-${chunkIdx++}`,
        vector: [],
        vaultPath: params.vaultPath,
        relativePath: params.relativePath,
        title,
        heading: section.heading,
        content: sectionContent,
        contentHash: params.hash,
        updatedAt: now,
      });
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
          if (!DEFAULT_IGNORED_DIRS.has(entry.name)) {
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
