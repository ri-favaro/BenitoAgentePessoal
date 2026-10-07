import * as lancedb from "@lancedb/lancedb";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface CodeChunkRecord {
  [key: string]: unknown;
  id: string;
  vector: number[];
  project: string;
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  language: string;
  content: string;
  contentHash: string;
  updatedAt: number;
}

export interface VaultChunkRecord {
  [key: string]: unknown;
  id: string;
  vector: number[];
  vaultPath: string;
  relativePath: string;
  title: string;
  heading: string;
  content: string;
  contentHash: string;
  updatedAt: number;
}

export interface CodeSearchResult extends CodeChunkRecord {
  similarity: number;
  distance: number;
}

export interface VaultSearchResult extends VaultChunkRecord {
  similarity: number;
  distance: number;
}

export class VectorStore {
  private dbPath: string;
  private db: lancedb.Connection | null = null;

  constructor(customDbPath?: string) {
    this.dbPath = customDbPath || config.vectorStore.dbPath;
  }

  /**
   * Conecta ao LanceDB garantindo que o diretório exista.
   */
  async getDb(): Promise<lancedb.Connection> {
    if (!this.db) {
      await fs.mkdir(this.dbPath, { recursive: true });
      this.db = await lancedb.connect(this.dbPath);
    }
    return this.db;
  }

  /**
   * Retorna os nomes das tabelas existentes.
   */
  async getTableNames(): Promise<string[]> {
    const db = await this.getDb();
    return await db.tableNames();
  }

  /**
   * Busca semântica vetorial na tabela de código (codebase).
   */
  async searchCodebase(
    queryVector: number[],
    options?: { project?: string; limit?: number }
  ): Promise<CodeSearchResult[]> {
    const db = await this.getDb();
    const tables = await db.tableNames();
    if (!tables.includes("codebase")) {
      return [];
    }

    const table = await db.openTable("codebase");
    const limit = options?.limit && options.limit > 0 ? options.limit : 5;

    let search = table.vectorSearch(queryVector).distanceType("cosine");
    if (options?.project) {
      const sanitizedProject = options.project.replace(/'/g, "''");
      search = search.where(`project = '${sanitizedProject}'`);
    }

    const rawResults = await search.limit(limit).toArray();

    return rawResults.map((r: any) => {
      const distance = typeof r._distance === "number" ? r._distance : 1;
      const similarity = Math.max(0, Math.min(1, 1 - distance));
      return {
        id: r.id,
        vector: r.vector,
        project: r.project,
        filePath: r.filePath,
        relativePath: r.relativePath,
        startLine: r.startLine,
        endLine: r.endLine,
        language: r.language,
        content: r.content,
        contentHash: r.contentHash,
        updatedAt: r.updatedAt,
        distance,
        similarity: Number(similarity.toFixed(4)),
      };
    });
  }

  /**
   * Busca semântica vetorial na tabela do cofre (vault).
   */
  async searchVault(
    queryVector: number[],
    options?: { limit?: number }
  ): Promise<VaultSearchResult[]> {
    const db = await this.getDb();
    const tables = await db.tableNames();
    if (!tables.includes("vault")) {
      return [];
    }

    const table = await db.openTable("vault");
    const limit = options?.limit && options.limit > 0 ? options.limit : 5;

    const rawResults = await table
      .vectorSearch(queryVector)
      .distanceType("cosine")
      .limit(limit)
      .toArray();

    return rawResults.map((r: any) => {
      const distance = typeof r._distance === "number" ? r._distance : 1;
      const similarity = Math.max(0, Math.min(1, 1 - distance));
      return {
        id: r.id,
        vector: r.vector,
        vaultPath: r.vaultPath,
        relativePath: r.relativePath,
        title: r.title,
        heading: r.heading,
        content: r.content,
        contentHash: r.contentHash,
        updatedAt: r.updatedAt,
        distance,
        similarity: Number(similarity.toFixed(4)),
      };
    });
  }

  /**
   * Insere ou atualiza chunks na tabela codebase.
   */
  async upsertCodebaseChunks(chunks: CodeChunkRecord[]): Promise<void> {
    if (!chunks || chunks.length === 0) return;

    const db = await this.getDb();
    const tables = await db.tableNames();

    if (!tables.includes("codebase")) {
      await db.createTable("codebase", chunks);
      return;
    }

    const table = await db.openTable("codebase");
    
    // Remove chunks antigos dos arquivos afetados antes de adicionar os novos
    const affectedFiles = Array.from(new Set(chunks.map((c) => c.relativePath)));
    for (const relPath of affectedFiles) {
      const sanitized = relPath.replace(/'/g, "''");
      try {
        await table.delete(`relativePath = '${sanitized}'`);
      } catch {
        // Ignora se não houver registros
      }
    }

    await table.add(chunks);
  }

  /**
   * Insere ou atualiza chunks na tabela vault.
   */
  async upsertVaultChunks(chunks: VaultChunkRecord[]): Promise<void> {
    if (!chunks || chunks.length === 0) return;

    const db = await this.getDb();
    const tables = await db.tableNames();

    if (!tables.includes("vault")) {
      await db.createTable("vault", chunks);
      return;
    }

    const table = await db.openTable("vault");

    // Remove chunks antigos dos arquivos afetados antes de adicionar os novos
    const affectedFiles = Array.from(new Set(chunks.map((c) => c.relativePath)));
    for (const relPath of affectedFiles) {
      const sanitized = relPath.replace(/'/g, "''");
      try {
        await table.delete(`relativePath = '${sanitized}'`);
      } catch {
        // Ignora se não houver registros
      }
    }

    await table.add(chunks);
  }

  /**
   * Obtém um mapa de relativePath -> contentHash das entradas armazenadas.
   */
  async getStoredHashes(tableName: "codebase" | "vault"): Promise<Map<string, string>> {
    const db = await this.getDb();
    const tables = await db.tableNames();
    const map = new Map<string, string>();

    if (!tables.includes(tableName)) {
      return map;
    }

    const table = await db.openTable(tableName);
    const records = await table.query().select(["relativePath", "contentHash"]).toArray();

    for (const rec of records) {
      if (rec.relativePath && rec.contentHash) {
        map.set(rec.relativePath, rec.contentHash);
      }
    }

    return map;
  }

  /**
   * Remove registros correspondentes a arquivos excluídos.
   */
  async deleteByRelativePaths(
    tableName: "codebase" | "vault",
    relativePaths: string[]
  ): Promise<void> {
    if (!relativePaths || relativePaths.length === 0) return;

    const db = await this.getDb();
    const tables = await db.tableNames();
    if (!tables.includes(tableName)) return;

    const table = await db.openTable(tableName);
    for (const relPath of relativePaths) {
      const sanitized = relPath.replace(/'/g, "''");
      try {
        await table.delete(`relativePath = '${sanitized}'`);
      } catch {
        // Ignora se não existir
      }
    }
  }
}
