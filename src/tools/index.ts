import { config } from "../config.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { createMemoryTools } from "./memory-tools.js";
import { createFilesystemTools } from "./filesystem-tools.js";
import { createWebTools, type WebToolsSessionState } from "./web-tools.js";
import { createFinanceTools } from "./finance-tools.js";

export function getAgentTools(
  memoryManager: MemoryManager,
  webToolsState?: WebToolsSessionState
) {
  return {
    ...createMemoryTools(memoryManager),
    ...createFilesystemTools(config.filesystem.allowedPaths),
    ...createWebTools(webToolsState),
    ...createFinanceTools(config.finance.financeDir, config.filesystem.allowedPaths),
  };
}
