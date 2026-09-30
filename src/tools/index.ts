import { MemoryManager } from "../memory/memory-manager.js";
import { createMemoryTools } from "./memory-tools.js";
import { createFilesystemTools } from "./filesystem-tools.js";

export function getAgentTools(memoryManager: MemoryManager) {
  return {
    ...createMemoryTools(memoryManager),
    ...createFilesystemTools(),
  };
}
