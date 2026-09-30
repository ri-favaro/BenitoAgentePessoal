import { tool } from "ai";
import { z } from "zod";
import { MemoryManager } from "../memory/memory-manager.js";

export function createMemoryTools(memoryManager: MemoryManager) {
  return {
    save_memory: tool({
      description:
        "Salva uma nova informação, preferência duradoura, fato importante ou decisão de projeto na memória persistente sobre o Luiz Ricardo.",
      parameters: z.object({
        fact: z
          .string()
          .describe("O fato objetivo ou preferência a ser lembrada com clareza."),
        category: z
          .string()
          .optional()
          .describe(
            "Categoria opcional (ex: 'Preferência', 'Tecnologia', 'Projeto', 'Pessoal')."
          ),
      }),
      execute: async ({ fact, category }) => {
        const result = await memoryManager.saveFact(fact, category);
        return { success: true, message: result };
      },
    }),

    update_persona: tool({
      description:
        "Atualiza a identidade do próprio agente (como alterar seu nome) ou suas diretrizes de estilo/comportamento na memória persistente permanente.",
      parameters: z.object({
        newName: z
          .string()
          .optional()
          .describe("Novo nome oficial para o agente (ex: 'Benito', etc.)."),
        styleOrRule: z
          .string()
          .optional()
          .describe(
            "Nova regra de comportamento, tom de voz ou estilo solicitada pelo usuário."
          ),
      }),
      execute: async ({ newName, styleOrRule }) => {
        const message = await memoryManager.updateAgentIdentity({
          newName,
          styleOrRule,
        });
        return { success: true, message };
      },
    }),
  };
}
