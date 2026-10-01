import path from "node:path";
import fs from "node:fs/promises";
import pc from "picocolors";
import { MemoryManager } from "../src/memory/memory-manager.js";
import { createMemoryTools } from "../src/tools/memory-tools.js";

async function runMemoryTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTE DO SISTEMA DE MEMÓRIA MODULAR & CONSOLIDAÇÃO ===\n")));

  // Cria um diretório de teste isolado para não afetar a memória do usuário
  const testDir = path.join(process.cwd(), "memory-test-temp");
  await fs.mkdir(testDir, { recursive: true });

  try {
    const memoryManager = new MemoryManager(testDir);
    await memoryManager.init();

    // Teste 1: Gravação e listagem de tópicos modulares
    console.log(pc.yellow("1. Testando gravação de tópicos modulares (save_topic_learning)..."));
    await memoryManager.saveTopicLearning(
      "web-search",
      "Em eventos de F1, inclua sempre o ano corrente na busca.",
      "Busca Web",
      "Diretrizes e estratégias de busca online"
    );
    await memoryManager.saveTopicLearning(
      "web-search",
      "Use fetch_web_page para ler a matéria oficial e validar cronologia."
    );
    await memoryManager.saveTopicLearning(
      "coding",
      "Priorize TypeScript com tipagem estrita e Node.js leve.",
      "Engenharia de Software",
      "Padrões de desenvolvimento e código limpo"
    );

    const topics = await memoryManager.listTopics();
    if (topics.length === 2 && topics.some((t) => t.slug === "web-search") && topics.some((t) => t.slug === "coding")) {
      console.log(pc.green(`✔ ${topics.length} tópicos modulares criados e listados com sucesso!`));
      for (const t of topics) {
        console.log(pc.dim(`  • ${t.slug} (${t.title}): ${t.count} regras`));
      }
    } else {
      throw new Error(`Falha ao listar tópicos: esperado 2, obtido ${topics.length}`);
    }

    // Teste 2: Leitura de conteúdo de um tópico
    console.log(pc.yellow("\n2. Testando leitura de tópico específico (readTopic)..."));
    const webSearchContent = await memoryManager.readTopic("web-search");
    if (webSearchContent && webSearchContent.includes("fetch_web_page") && webSearchContent.includes("F1")) {
      console.log(pc.green("✔ Conteúdo do tópico 'web-search' lido com sucesso e preservado!"));
    } else {
      throw new Error("Falha ao ler conteúdo do tópico 'web-search'");
    }

    // Teste 3: Geração de índice compacto para o system prompt
    console.log(pc.yellow("\n3. Testando geração de índice compacto de tópicos (readAllTopicsIndex)..."));
    const indexText = await memoryManager.readAllTopicsIndex();
    if (indexText.includes("**web-search**") && indexText.includes("**coding**")) {
      console.log(pc.green("✔ Índice compacto gerado com sucesso!"));
      console.log(pc.dim("  Prévia do índice:"));
      console.log(pc.dim(indexText));
    } else {
      throw new Error("Falha ao gerar índice de tópicos");
    }

    // Teste 4: Ferramentas de tool calling
    console.log(pc.yellow("\n4. Testando execução das tools (read_topic_memory e list_memory_topics)..."));
    const tools = createMemoryTools(memoryManager);

    const listResult = await tools.list_memory_topics.execute({}, { messages: [], toolCallId: "test-list" });
    if (listResult.success && listResult.topics.length === 2) {
      console.log(pc.green("✔ Ferramenta list_memory_topics executada com sucesso!"));
    } else {
      throw new Error("Falha na ferramenta list_memory_topics");
    }

    const readResult = await tools.read_topic_memory.execute(
      { topicSlug: "web-search" },
      { messages: [], toolCallId: "test-read" }
    );
    if (readResult.success && readResult.content.includes("fetch_web_page")) {
      console.log(pc.green("✔ Ferramenta read_topic_memory executada com sucesso!"));
    } else {
      throw new Error("Falha na ferramenta read_topic_memory");
    }

    // Teste 5: Consolidação com Mock de LLM (validação de parsing, segurança e integridade)
    console.log(pc.yellow("\n5. Testando consolidação de memória com parser seguro..."));
    
    // Injeta profile e learnings para simular memória bruta
    await memoryManager.saveFact("Prefere trabalhar no Windows com RTX 4070 Ti");
    await memoryManager.saveFact("Trabalha com TypeScript e Docker");
    await memoryManager.saveLearning("Não responda com frases prolixas");
    await memoryManager.saveLearning("Desarme a palavra último em buscas");

    // Mock do modelo retornando JSON de consolidação
    const mockModel: any = {
      specificationVersion: "v1",
      modelId: "mock-model",
      provider: "mock",
      defaultObjectGenerationMode: "json",
      doGenerate: async () => ({
        text: JSON.stringify({
          consolidatedLearnings:
            "# Aprendizados Operacionais Mestres\n\n- [Comportamento] Responda de forma direta e concisa sem prolixidade.\n- [Proatividade] Execute correções de primeira.",
          consolidatedProfile:
            "# Perfil do Usuário\n\n- Nome: Luiz Ricardo\n- Hardware: RTX 4070 Ti no Windows\n- Stack: TypeScript, Docker",
          topics: [
            {
              slug: "web-search",
              title: "Busca Web e Pesquisa Online",
              description: "Estratégias de busca no SearXNG e leitura profunda",
              rules: [
                "Desarme a palavra 'último' substituindo por termos jornalísticos como 'novo' ou 'anuncia'.",
                "Em eventos esportivos ou lançamentos, inclua sempre o ano corrente.",
              ],
            },
          ],
          summary: "Memória consolidada: 2 regras mestras em learnings.md, 1 tópico especializado (web-search) e perfil reorganizado.",
        }),
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50 },
        rawCall: {},
      }),
    };

    const consolidationResult = await memoryManager.consolidateMemory(mockModel);
    if (consolidationResult.success) {
      console.log(pc.green("✔ Consolidação executada com sucesso!"));
      console.log(pc.dim(`  Resumo retornado: "${consolidationResult.summary}"`));

      const updatedLearnings = await memoryManager.readLearnings();
      const updatedProfile = await memoryManager.readProfile();
      const consolidatedWebSearch = await memoryManager.readTopic("web-search");

      if (
        updatedLearnings.includes("Aprendizados Operacionais Mestres") &&
        updatedProfile.includes("RTX 4070 Ti") &&
        consolidatedWebSearch?.includes("Desarme a palavra 'último'")
      ) {
        console.log(pc.green("✔ Arquivos no disco atualizados com a síntese de forma segura!"));
      } else {
        throw new Error("Arquivos no disco não refletiram a consolidação.");
      }
    } else {
      throw new Error(`Falha na consolidação: ${consolidationResult.summary}`);
    }

    // Teste 6: Consolidação com histórico de sessão ativa
    console.log(pc.yellow("\n6. Testando consolidação com histórico de sessão ativa (sessionHistory)..."));
    let capturedPrompt = "";
    const mockModelWithHistory: any = {
      specificationVersion: "v1",
      modelId: "mock-model-history",
      provider: "mock",
      defaultObjectGenerationMode: "json",
      doGenerate: async (options: any) => {
        capturedPrompt = JSON.stringify(options.prompt);
        return {
          text: JSON.stringify({
            consolidatedLearnings:
              "# Aprendizados Operacionais Mestres\n\n- [Comportamento] Direto e conciso.",
            consolidatedProfile:
              "# Perfil do Usuário\n\n- Nome: Luiz Ricardo\n- Hardware: RTX 4070 Ti\n\n## Ideias e Projetos\n- Integração com GitHub para criar issues de auto-melhoria.",
            topics: [
              {
                slug: "github",
                title: "Integração GitHub",
                description: "Diretrizes para automação e abertura de issues",
                rules: [
                  "Sempre peça autorização antes de criar uma issue no repositório.",
                ],
              },
            ],
            summary: "Extraído da sessão o plano de integrar tool do GitHub e criado tópico especializado github.",
          }),
          finishReason: "stop",
          usage: { promptTokens: 120, completionTokens: 60 },
          rawCall: {},
        };
      },
    };

    const sessionHistory: any = [
      { role: "user", content: "Qual outra ferramenta você queria ter acesso?" },
      { role: "assistant", content: "Poderíamos ter uma ferramenta do GitHub." },
      { role: "user", content: "Boa! Aí você abre issues com sugestões de melhorias." },
    ];

    const resultWithHistory = await memoryManager.consolidateMemory(mockModelWithHistory, sessionHistory);
    if (
      resultWithHistory.success &&
      capturedPrompt.includes("Qual outra ferramenta você queria ter acesso?") &&
      capturedPrompt.includes("Boa! Aí você abre issues com sugestões de melhorias.")
    ) {
      console.log(pc.green("✔ Histórico da sessão foi devidamente injetado no prompt de consolidação!"));
      const updatedProfile = await memoryManager.readProfile();
      const githubTopic = await memoryManager.readTopic("github");
      if (updatedProfile.includes("Integração com GitHub") && githubTopic?.includes("Sempre peça autorização")) {
        console.log(pc.green("✔ Dados da sessão foram consolidados em profile.md e memory/topics/github.md!"));
      } else {
        throw new Error("Dados da sessão não foram refletidos nos arquivos.");
      }
    } else {
      throw new Error("Falha na consolidação com histórico: prompt incompleto ou erro.");
    }

    console.log(pc.bold(pc.green("\nTodos os testes de memória passaram com sucesso! 🚀\n")));
  } finally {
    // Limpeza da pasta temporária de teste
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

runMemoryTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste de memória:"), err);
  process.exit(1);
});
