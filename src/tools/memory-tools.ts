import { tool } from "ai";
import { z } from "zod";
import { MemoryManager } from "../memory/memory-manager.js";

export function createMemoryTools(memoryManager: MemoryManager) {
  return {
    save_memory: tool({
      description:
        "Salva uma nova informação biográfica, preferência pessoal duradoura ou nota sobre o usuário Luiz Ricardo em memory/profile.md.",
      parameters: z.object({
        fact: z
          .string()
          .describe("O fato objetivo ou preferência sobre o usuário a ser lembrada com clareza."),
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

    save_learning: tool({
      description:
        "Registra uma lição aprendida, feedback corretivo do usuário ou regra operacional permanente em memory/learnings.md. Use SEMPRE que o usuário te ensinar como agir, corrigir seu procedimento de busca ou exigir um comportamento de primeira para conversas futuras.",
      parameters: z.object({
        lesson: z
          .string()
          .describe(
            "A diretriz prática ou lição aprendida que você deve seguir obrigatoriamente desde a primeira tentativa."
          ),
        category: z
          .string()
          .optional()
          .describe(
            "Categoria opcional da lição (ex: 'Busca Web', 'Comportamento', 'Formulação de Query')."
          ),
      }),
      execute: async ({ lesson, category }) => {
        const message = await memoryManager.saveLearning(lesson, category);
        return { success: true, message };
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

    read_topic_memory: tool({
      description:
        "Lê o conteúdo completo de um tópico de memória especializada em memory/topics/ (ex: 'web-search', 'coding', 'sports'). Use quando a conversa exigir diretrizes ou regras aprofundadas de um domínio específico.",
      parameters: z.object({
        topicSlug: z
          .string()
          .describe("O identificador/slug do tópico (ex: 'web-search', 'sports', 'coding')."),
      }),
      execute: async ({ topicSlug }) => {
        const content = await memoryManager.readTopic(topicSlug);
        if (!content) {
          return {
            success: false,
            message: `Tópico '${topicSlug}' não encontrado na pasta memory/topics/.`,
          };
        }
        return { success: true, topicSlug, content };
      },
    }),

    save_topic_learning: tool({
      description:
        "Salva uma regra prática ou aprendizado operacional diretamente dentro de um arquivo de tópico especializado em memory/topics/<slug>.md (ex: 'web-search', 'sports', 'coding'). Use para manter a memória limpa e modularizada por domínio.",
      parameters: z.object({
        topicSlug: z
          .string()
          .describe("Slug do domínio/tópico em minúsculas sem espaços (ex: 'web-search', 'sports', 'coding')."),
        lesson: z
          .string()
          .describe("A regra, procedimento ou lição a ser registrada para este tópico específico."),
        title: z
          .string()
          .optional()
          .describe("Título amigável para o tópico caso ele ainda não exista (ex: 'Busca Web e Pesquisa')."),
        description: z
          .string()
          .optional()
          .describe("Breve descrição do propósito deste tópico se for novo."),
      }),
      execute: async ({ topicSlug, lesson, title, description }) => {
        const message = await memoryManager.saveTopicLearning(
          topicSlug,
          lesson,
          title,
          description
        );
        return { success: true, message };
      },
    }),

    list_memory_topics: tool({
      description:
        "Lista todos os tópicos de memória especializada disponíveis na pasta memory/topics/, com seus resumos e quantidade de regras ativas.",
      parameters: z.object({}),
      execute: async () => {
        const topics = await memoryManager.listTopics();
        return { success: true, topics };
      },
    }),
  };
}
