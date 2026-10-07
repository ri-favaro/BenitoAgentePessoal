import pc from "picocolors";
import { config } from "../src/config.js";
import { EmbeddingService } from "../src/core/embedding-service.js";
import { VectorStore } from "../src/core/vector-store.js";
import { KnowledgeIndexer } from "../src/core/indexer.js";

async function main() {
  console.log("\n" + pc.bold(pc.cyan("==================================================")));
  console.log(pc.bold(pc.cyan("   BENITO - INDEXAÇÃO INCREMENTAL DE CONHECIMENTO ")));
  console.log(pc.bold(pc.cyan("==================================================")));
  console.log(pc.gray(`• LanceDB Path:       `) + pc.magenta(config.vectorStore.dbPath));
  console.log(pc.gray(`• Embedding Endpoint: `) + pc.blue(config.embedding.baseUrl));
  console.log(pc.gray(`• Pastas Codebase:    `) + pc.yellow(config.filesystem.allowedPaths.join(", ")));
  console.log(pc.gray(`• Cofre Obsidian:     `) + pc.green(config.finance.vaultPath));
  console.log(pc.gray("--------------------------------------------------\n"));

  const embeddingService = new EmbeddingService();
  const vectorStore = new VectorStore();
  const indexer = new KnowledgeIndexer(embeddingService, vectorStore);

  console.log(pc.cyan("🔍 Verificando disponibilidade do serviço de embeddings..."));
  const isOnline = await embeddingService.isAvailable();
  if (!isOnline) {
    console.log(
      pc.red(
        `\n✖ Erro: O serviço de embeddings está offline em ${config.embedding.baseUrl}.\n` +
          `Inicie o serviço executando: npm run embedding:serve ou 'scripts/start-embedding-server.ps1'\n`
      )
    );
    process.exit(1);
  }
  console.log(pc.green("✔ Serviço de embeddings online e responsivo!\n"));

  // 1. Indexação dos Repositórios de Código
  console.log(pc.bold(pc.cyan("📂 [1/2] Indexando Repositórios de Código (Codebase)...")));
  try {
    const codeSummary = await indexer.indexCodebase(config.filesystem.allowedPaths);
    console.log(pc.green(`✔ Codebase indexado em ${codeSummary.durationMs}ms:`));
    console.log(pc.gray(`  - Arquivos escaneados:   ${codeSummary.totalScanned}`));
    console.log(pc.gray(`  - Novos/Atualizados:     ${codeSummary.filesIndexed}`));
    console.log(pc.gray(`  - Inalterados (pulados): ${codeSummary.filesSkipped}`));
    console.log(pc.gray(`  - Excluídos do banco:    ${codeSummary.filesDeleted}`));
    console.log(pc.gray(`  - Chunks gerados:        ${codeSummary.chunksCreated}`));
  } catch (err: any) {
    console.log(pc.red(`✖ Falha ao indexar codebase: ${err.message}`));
  }

  // 2. Indexação do Cofre do Obsidian
  console.log(pc.bold(pc.cyan("\n📓 [2/2] Indexando Cofre do Obsidian (Vault)...")));
  try {
    const vaultSummary = await indexer.indexVault(config.finance.vaultPath);
    console.log(pc.green(`✔ Cofre indexado em ${vaultSummary.durationMs}ms:`));
    console.log(pc.gray(`  - Arquivos escaneados:   ${vaultSummary.totalScanned}`));
    console.log(pc.gray(`  - Novos/Atualizados:     ${vaultSummary.filesIndexed}`));
    console.log(pc.gray(`  - Inalterados (pulados): ${vaultSummary.filesSkipped}`));
    console.log(pc.gray(`  - Excluídos do banco:    ${vaultSummary.filesDeleted}`));
    console.log(pc.gray(`  - Chunks gerados:        ${vaultSummary.chunksCreated}`));
  } catch (err: any) {
    console.log(pc.red(`✖ Falha ao indexar cofre: ${err.message}`));
  }

  console.log(pc.bold(pc.green("\n🎉 Processo de indexação concluído com sucesso!\n")));
}

main().catch((err) => {
  console.error(pc.red("Erro fatal no processo de indexação:"), err);
  process.exit(1);
});
