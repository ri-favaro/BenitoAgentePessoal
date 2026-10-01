import { MemoryManager } from "../memory/memory-manager.js";
import { createMemoryTools } from "./memory-tools.js";
import { createFilesystemTools } from "./filesystem-tools.js";
import { createWebTools, type WebToolsSessionState } from "./web-tools.js";

export function getAgentTools(
  memoryManager: MemoryManager,
  webToolsState?: WebToolsSessionState
) {
  return {
    ...createMemoryTools(memoryManager),
    ...createFilesystemTools(),
    ...createWebTools(webToolsState),
  };
}

