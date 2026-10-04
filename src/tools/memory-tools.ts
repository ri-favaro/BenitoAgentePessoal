import { tool } from "ai";
import { z } from "zod";
import { MemoryManager } from "../memory/memory-manager.js";

export function createMemoryTools(memoryManager: MemoryManager) {
  return {
    save_memory: tool({
      description:
        "Salva uma nova informação biográfica duradoura, preferência pessoal ou nota de projeto sobre o usuário Luiz Ricardo em memory/profile.md. NUNCA use para dados efêmeros, resultados de pesquisas na internet ou fatos de domínio público.",
      parameters: z.object({
        fact: z
          .string()
          .describe("O fato duradouro ou preferência sobre o usuário Luiz Ricardo a ser lembrado."),
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
        "Registra uma lição aprendida, feedback corretivo do usuário ou regra operacional permanente em memory/learnings.md. Use EXCLUSIVAMENTE quando o usuário te ensinar como agir, corrigir seu procedimento de raciocínio/busca ou exigir uma regra de comportamento para conversas futuras. ATENÇÃO: NUNCA utilize esta ferramenta para salvar fatos pontuais, notícias, eventos, calendários de terceiros ou resultados de busca na web (esses dados são voláteis e devem ser buscados na internet sob demanda via search_web).",
      parameters: z.object({
        lesson: z
          .string()
          .describe(
            "A diretriz prática, conduta ou procedimento operacional (NUNCA dados factuais de eventos externos, datas ou calendários)."
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
        "Salva uma regra prática, heurística ou procedimento operacional diretamente dentro de um arquivo de tópico especializado em memory/topics/<slug>.md (ex: 'web-search', 'sports', 'coding'). NUNCA use para salvar dados factuais voláteis, notícias ou calendários (use apenas para heurísticas e procedimentos de como operar naquele domínio).",
      parameters: z.object({
        topicSlug: z
          .string()
          .describe("Slug do domínio/tópico em minúsculas sem espaços (ex: 'web-search', 'sports', 'coding')."),
        lesson: z
          .string()
          .describe("A regra, procedimento ou heurística a ser registrada para este tópico específico."),
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
