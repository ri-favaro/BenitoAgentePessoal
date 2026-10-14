import { config } from "../config.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { createMemoryTools } from "./memory-tools.js";
import { createFilesystemTools } from "./filesystem-tools.js";
import { createWebTools, type WebToolsSessionState } from "./web-tools.js";
import { createFinanceTools } from "./finance-tools.js";
import { createRetrievalTools } from "./retrieval-tools.js";
import { createAuditTools } from "./audit-tools.js";
import { createGitHubTools } from "./github-tools.js";
import { createObsidianTools } from "./obsidian-tools.js";
import { createOrchestrationTools } from "./orchestration-tools.js";
import { EmbeddingService } from "../core/embedding-service.js";
import { VectorStore } from "../core/vector-store.js";
import { KnowledgeIndexer } from "../core/indexer.js";
import { SelfAuditor } from "../core/self-auditor.js";
import { GitHubService } from "../core/github-service.js";

// Instâncias compartilhadas para o ciclo de vida das ferramentas
let sharedVectorStore: VectorStore | null = null;
let sharedEmbeddingService: EmbeddingService | null = null;
let sharedIndexer: KnowledgeIndexer | null = null;
let sharedAuditor: SelfAuditor | null = null;
let sharedGitHubService: GitHubService | null = null;

function getSharedRetrievalInstances() {
  if (!sharedVectorStore) {
    sharedVectorStore = new VectorStore(config.vectorStore.dbPath);
  }
  if (!sharedEmbeddingService) {
    sharedEmbeddingService = new EmbeddingService();
  }
  if (!sharedIndexer) {
    sharedIndexer = new KnowledgeIndexer(sharedEmbeddingService, sharedVectorStore);
  }
  if (!sharedAuditor) {
    sharedAuditor = new SelfAuditor();
  }
  if (!sharedGitHubService) {
    sharedGitHubService = new GitHubService();
  }
  return {
    vectorStore: sharedVectorStore,
    embeddingService: sharedEmbeddingService,
    indexer: sharedIndexer,
    auditor: sharedAuditor,
    gitHubService: sharedGitHubService,
  };
}

export function getAgentTools(
  memoryManager: MemoryManager,
  webToolsState?: WebToolsSessionState
) {
  const { vectorStore, embeddingService, indexer, auditor, gitHubService } =
    getSharedRetrievalInstances();

  return {
    ...createMemoryTools(memoryManager),
    ...createFilesystemTools(config.filesystem.allowedPaths),
    ...createWebTools(webToolsState),
    ...createFinanceTools(config.finance.financeDir, config.filesystem.allowedPaths),
    ...createObsidianTools(
      config.obsidian.vaultPath,
      config.obsidian.dailyNotesDir,
      config.filesystem.allowedPaths
    ),
    ...createRetrievalTools(
      vectorStore,
      embeddingService,
      indexer,
      config.filesystem.allowedPaths,
      config.finance.vaultPath
    ),
    ...createAuditTools(auditor),
    ...createGitHubTools(gitHubService),
    ...createOrchestrationTools({
      gitHubService,
      vectorStore,
      embeddingService,
    }),
  };
}
