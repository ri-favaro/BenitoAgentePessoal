import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  EmbeddingService,
  normalizeL2,
  cosineSimilarity,
} from "../src/core/embedding-service.js";
import { VectorStore } from "../src/core/vector-store.js";
import { KnowledgeIndexer } from "../src/core/indexer.js";
import { createRetrievalTools } from "../src/tools/retrieval-tools.js";

async function runRetrievalTests() {
  console.log("🧪 Iniciando testes de Recuperação Semântica (EmbeddingGemma 2 + LanceDB)...\n");

  const tempDir = path.resolve(process.cwd(), ".test-lancedb-tmp");
  await fs.rm(tempDir, { recursive: true, force: true });

  try {
    // ==========================================
    // 1. Testes de Vetores e Normalização (MRL)
    // ==========================================
    console.log("1. Testando normalizeL2 e cosineSimilarity...");
    const rawVec = [3, 4];
    const normVec = normalizeL2(rawVec);
    // Norma de [3, 4] é 5 => [0.6, 0.8]
    assert.strictEqual(Number(normVec[0].toFixed(2)), 0.6);
    assert.strictEqual(Number(normVec[1].toFixed(2)), 0.8);

    const simIdentical = cosineSimilarity(normVec, normVec);
    assert.strictEqual(Math.round(simIdentical), 1);

    const orthogonal = normalizeL2([4, -3]);
    const simOrthogonal = cosineSimilarity(normVec, orthogonal);
    assert.strictEqual(Math.round(simOrthogonal), 0);
    console.log("✔ Matemática de vetores e MRL validada com sucesso!");

    // ==========================================
    // 2. Testes de Offline Gracioso do EmbeddingService
    // ==========================================
    console.log("\n2. Testando resiliência offline do EmbeddingService...");
    const offlineService = new EmbeddingService({
      baseUrl: "http://127.0.0.1:59999/v1", // porta sabidamente fechada
      timeoutMs: 1000,
    });
    const isOnline = await offlineService.isAvailable();
    assert.strictEqual(isOnline, false);

    let offlineErrorCaught = false;
    try {
      await offlineService.getEmbedding("teste");
    } catch (err: any) {
      offlineErrorCaught = true;
      assert.ok(
        err.message.includes("inacessível") ||
          err.message.includes("fetch failed") ||
          err.message.includes("Timeout"),
        `Mensagem de erro amigável esperada, recebido: ${err.message}`
      );
    }
    assert.strictEqual(offlineErrorCaught, true);
    console.log("✔ Detecção amigável de serviço offline validada com sucesso!");

    // ==========================================
    // 3. Testes de Persistência e Busca no LanceDB (VectorStore)
    // ==========================================
    console.log("\n3. Testando VectorStore (LanceDB) isolado...");
    const store = new VectorStore(tempDir);

    // Chunks de teste para codebase
    const codeChunks = [
      {
        id: "contele-os/src/auth.ts:1-20",
        vector: normalizeL2([0.9, 0.1, 0.0, 0.0]),
        project: "contele-os",
        filePath: path.resolve(process.cwd(), "src/auth.ts"),
        relativePath: "contele-os/src/auth.ts",
        startLine: 1,
        endLine: 20,
        language: "ts",
        content: "export function validateJwt(token: string) { return true; }",
        contentHash: "hash-jwt-1",
        updatedAt: Date.now(),
      },
      {
        id: "benito/src/finance.ts:1-30",
        vector: normalizeL2([0.0, 0.1, 0.9, 0.2]),
        project: "benito",
        filePath: path.resolve(process.cwd(), "src/finance.ts"),
        relativePath: "benito/src/finance.ts",
        startLine: 1,
        endLine: 30,
        language: "ts",
        content: "export function calculateBurnRate() { return 150.0; }",
        contentHash: "hash-finance-1",
        updatedAt: Date.now(),
      },
    ];

    await store.upsertCodebaseChunks(codeChunks);

    // Busca com vetor próximo ao JWT
    const searchVecJwt = normalizeL2([0.85, 0.15, 0.0, 0.0]);
    const resultsJwt = await store.searchCodebase(searchVecJwt, { limit: 2 });
    assert.strictEqual(resultsJwt.length, 2);
    assert.strictEqual(resultsJwt[0].project, "contele-os");
    assert.ok(resultsJwt[0].similarity > 0.9, "Similaridade esperada > 0.9");

    // Busca filtrada por projeto
    const filteredResults = await store.searchCodebase(searchVecJwt, {
      project: "benito",
      limit: 2,
    });
    assert.strictEqual(filteredResults.length, 1);
    assert.strictEqual(filteredResults[0].project, "benito");

    // Chunks de teste para vault (Obsidian)
    const vaultChunks = [
      {
        id: "notas/arquitetura.md:sec-1",
        vector: normalizeL2([0.1, 0.8, 0.2, 0.1]),
        vaultPath: "G:/CofreObsidian/AgentePessoal",
        relativePath: "notas/arquitetura.md",
        title: "arquitetura",
        heading: "Decisão de Embeddings",
        content: "Decidimos utilizar EmbeddingGemma 2 com LanceDB.",
        contentHash: "hash-vault-1",
        updatedAt: Date.now(),
      },
    ];

    await store.upsertVaultChunks(vaultChunks);
    const searchVecVault = normalizeL2([0.1, 0.75, 0.2, 0.1]);
    const vaultResults = await store.searchVault(searchVecVault, { limit: 2 });
    assert.strictEqual(vaultResults.length, 1);
    assert.strictEqual(vaultResults[0].title, "arquitetura");
    assert.ok(vaultResults[0].similarity > 0.9);

    // Validação de getStoredHashes
    const codeHashes = await store.getStoredHashes("codebase");
    assert.strictEqual(codeHashes.get("contele-os/src/auth.ts"), "hash-jwt-1");
    assert.strictEqual(codeHashes.get("benito/src/finance.ts"), "hash-finance-1");

    // Validação de remoção de arquivos deletados
    await store.deleteByRelativePaths("codebase", ["contele-os/src/auth.ts"]);
    const codeHashesAfter = await store.getStoredHashes("codebase");
    assert.strictEqual(codeHashesAfter.has("contele-os/src/auth.ts"), false);
    assert.strictEqual(codeHashesAfter.has("benito/src/finance.ts"), true);

    console.log("✔ LanceDB: inserção, busca de cosseno, filtros e deleção validados!");

    // ==========================================
    // 4. Testes de Chunking do Indexer
    // ==========================================
    console.log("\n4. Testando chunking de código e Markdown...");
    const indexer = new KnowledgeIndexer(offlineService, store);

    // Arquivo de código pequeno (<= 300 linhas): 1 chunk
    const shortCode = "const a = 1;\nconst b = 2;\n";
    const shortChunks = indexer.chunkCodeFile({
      filePath: "src/sample.ts",
      relativePath: "sample.ts",
      projectName: "sample",
      content: shortCode,
      hash: "hash-short",
    });
    assert.strictEqual(shortChunks.length, 1);
    assert.strictEqual(shortChunks[0].startLine, 1);
    assert.strictEqual(shortChunks[0].endLine, 3);

    // Arquivo de código longo (> 60 linhas): múltiplos chunks com overlap
    const longCodeLines = Array.from({ length: 450 }, (_, i) => `line ${i + 1}`).join("\n");
    const longChunks = indexer.chunkCodeFile({
      filePath: "src/long.ts",
      relativePath: "long.ts",
      projectName: "long",
      content: longCodeLines,
      hash: "hash-long",
    });
    assert.ok(longChunks.length >= 2, "Arquivo de 450 linhas deve gerar múltiplos chunks");
    assert.strictEqual(longChunks[0].startLine, 1);
    assert.strictEqual(longChunks[0].endLine, 60);

    // Chunking de Markdown
    const markdownContent = `# Titulo da Nota\n\nIntrodução.\n\n## Secao 1\n\nConteudo da secao 1.\n\n## Secao 2\n\nConteudo da secao 2.`;
    const mdChunks = indexer.chunkMarkdownFile({
      vaultPath: "G:/Vault",
      filePath: "G:/Vault/teste.md",
      relativePath: "teste.md",
      content: markdownContent,
      hash: "hash-md",
    });
    assert.strictEqual(mdChunks.length, 3);
    assert.strictEqual(mdChunks[0].heading, "Titulo da Nota");
    assert.strictEqual(mdChunks[1].heading, "Secao 1");
    assert.strictEqual(mdChunks[2].heading, "Secao 2");

    // Chunking de PDF
    const pdfLines = Array.from({ length: 120 }, (_, i) => `Linha do documento técnico ${i + 1}`).join("\n");
    const pdfChunks = indexer.chunkCodeFile({
      filePath: "G:/MBA-EngSoftware/resumo.pdf",
      relativePath: "MBA-EngSoftware/resumo.pdf",
      projectName: "MBA-EngSoftware",
      content: pdfLines,
      hash: "hash-pdf-1",
    });
    assert.ok(pdfChunks.length >= 2, "PDF longo deve ser fragmentado em múltiplos chunks");
    assert.strictEqual(pdfChunks[0].language, "pdf");
    assert.strictEqual(pdfChunks[0].project, "MBA-EngSoftware");
    console.log("✔ Algoritmos de chunking (Código, Markdown e PDF) validados com precisão!");

    // ==========================================
    // 5. Testes das Tools com Trava de Sandbox
    // ==========================================
    console.log("\n5. Testando tools de busca semântica com sandbox (path-guard)...");
    
    // Mock do EmbeddingService para retornar vetor fixo sem depender do servidor HTTP
    class MockEmbeddingService extends EmbeddingService {
      async getEmbedding(text: string): Promise<number[]> {
        return normalizeL2([0.0, 0.1, 0.9, 0.2]);
      }
    }

    const mockEmbedding = new MockEmbeddingService();
    const allowedPath = path.resolve(process.cwd());
    const tools = createRetrievalTools(
      store,
      mockEmbedding,
      indexer,
      [allowedPath],
      path.resolve(process.cwd(), "memory")
    );

    // Busca com projeto não autorizado
    const forbiddenProjectResult: any = await tools.search_codebase.execute({
      query: "jwt token",
      project: "projeto_proibido_hacker",
      limit: 5,
    });
    assert.strictEqual(forbiddenProjectResult.success, false);
    assert.ok(
      forbiddenProjectResult.error.includes("Acesso negado") ||
        forbiddenProjectResult.error.includes("desconhecido"),
      `Acesso negado esperado, obtido: ${forbiddenProjectResult.error}`
    );

    // Busca com sucesso em projeto autorizado
    const safeProjectResult: any = await tools.search_codebase.execute({
      query: "burn rate financas",
      project: path.basename(allowedPath),
      limit: 5,
    });
    assert.strictEqual(safeProjectResult.success, true);
    assert.ok(Array.isArray(safeProjectResult.results));
    console.log("✔ Sandbox e proteção de path-guard das tools validados!");

    console.log("\n🎉 Todos os testes de Recuperação Semântica passaram com 100% de sucesso!");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

runRetrievalTests().catch((err) => {
  console.error("✖ Falha nos testes de recuperação:", err);
  process.exit(1);
});
