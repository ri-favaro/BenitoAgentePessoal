import { createWebTools, formatSearchResults } from "../src/tools/web-tools.js";
import pc from "picocolors";

async function runTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTE DA FERRAMENTA SEARCH_WEB (SEARXNG) ===\n")));

  const tools = createWebTools();

  // Teste 1: Formatador com dados simulados
  console.log(pc.yellow("1. Testando formatador de resultados com dados mockados..."));
  const mockFormatted = formatSearchResults(
    {
      answers: ["Resposta direta de teste"],
      infoboxes: [
        {
          infobox: "Artigo Exemplo",
          content: "Resumo explicativo sobre o assunto.",
          urls: [{ title: "Wikipedia", url: "https://exemplo.com" }],
        },
      ],
      results: [
        {
          title: "Resultado 1",
          url: "https://exemplo.com/1",
          content: "Conteúdo de exemplo do primeiro resultado.",
        },
      ],
    },
    5
  );

  if (
    mockFormatted.includes("Resposta direta de teste") &&
    mockFormatted.includes("Artigo Exemplo") &&
    mockFormatted.includes("Resultado 1")
  ) {
    console.log(pc.green("✔ Formatador gerou markdown com sucesso!\n"));
  } else {
    console.error(pc.red("✖ Falha no formatador:"));
    console.log(mockFormatted);
    process.exit(1);
  }

  // Teste 2: Busca real no SearXNG local
  console.log(pc.yellow("2. Testando busca real no SearXNG ('Node.js', 3 resultados)..."));
  const searchResult = await tools.search_web.execute(
    { query: "Node.js", numResults: 3 },
    { messages: [], toolCallId: "test-1" }
  );

  console.log("Resultado da execução:", {
    success: searchResult.success,
    query: searchResult.query,
    totalFound: searchResult.totalFound,
    resultsCount: searchResult.resultsCount,
    hasSummary: Boolean(searchResult.summary),
  });

  if (searchResult.success && searchResult.summary) {
    console.log(pc.green("\n✔ Busca no SearXNG executada com sucesso!"));
    console.log(pc.dim("\nPrévia do resumo formatado enviado para a LLM:"));
    console.log(pc.gray("--------------------------------------------------"));
    console.log(searchResult.summary);
    console.log(pc.gray("--------------------------------------------------"));
  } else {
    console.error(pc.red(`\n✖ Falha na busca: ${searchResult.error}`));
    process.exit(1);
  }

  // Teste 3: Simulação de serviço offline
  console.log(pc.yellow("\n3. Testando comportamento amigável quando o SearXNG está offline..."));
  const { config } = await import("../src/config.js");
  const originalUrl = config.searxng.baseUrl;
  config.searxng.baseUrl = "http://localhost:59999"; // Porta fechada garantida

  const offlineResult = await tools.search_web.execute(
    { query: "Teste Offline", numResults: 3 },
    { messages: [], toolCallId: "test-offline" }
  );

  config.searxng.baseUrl = originalUrl; // Restaura

  if (!offlineResult.success && offlineResult.error?.includes("docker start searxng")) {
    console.log(pc.green("✔ Erro offline tratado com sucesso e orientação do Docker retornada!\n"));
  } else {
    console.error(pc.red("✖ Falha na detecção de serviço offline:"), offlineResult);
    process.exit(1);
  }

  // Teste 4: Busca de notícias e eventos recentes (general,news)
  console.log(pc.yellow("4. Testando busca em tempo real com categorias 'general,news' ('Peugeot 9X8 Fuji')..."));
  const newsResult = await tools.search_web.execute(
    { query: "Peugeot 9X8 Fuji", numResults: 3, categories: "general,news" },
    { messages: [], toolCallId: "test-news" }
  );

  if (newsResult.success && newsResult.summary?.toLowerCase().includes("fuji")) {
    console.log(pc.green("✔ Evento recente encontrado com sucesso usando general,news!\n"));
  } else {
    console.error(pc.red("✖ Falha na busca de eventos recentes:"), newsResult);
    process.exit(1);
  }

  // Teste 5: Desarme da armadilha de termos (query com 'último modelo LLM Google 2026' deve encontrar Argon)
  console.log(
    pc.yellow(
      "5. Testando desarme da armadilha de termos ('último modelo LLM Google 2026')..."
    )
  );
  const argonResult = await tools.search_web.execute(
    { query: "último modelo LLM Google 2026", numResults: 5 },
    { messages: [], toolCallId: "test-argon" }
  );

  if (
    argonResult.success &&
    argonResult.summary?.toLowerCase().includes("argon")
  ) {
    console.log(
      pc.green("✔ Armadilha desarmada: query sanitizada encontrou 'Gemini 4 Argon'!\n")
    );
  } else {
    console.error(pc.red("✖ Falha ao encontrar Argon:"), argonResult.summary);
    process.exit(1);
  }

  // Teste 6: Leitura profunda de página web (fetch_web_page)
  console.log(pc.yellow("6. Testando leitura profunda de página web (fetch_web_page)..."));
  const pageResult = await tools.fetch_web_page.execute(
    { url: "https://pt.wikipedia.org/wiki/BTS_World_Tour_Arirang" },
    { messages: [], toolCallId: "test-fetch-bts" }
  );

  if (pageResult.success && pageResult.content && pageResult.content.length > 200) {
    console.log(pc.green(`✔ Página lida com sucesso! Título: "${pageResult.title}"`));
    console.log(pc.dim(`Tamanho do texto extraído: ${pageResult.content.length} caracteres.\n`));
  } else {
    console.error(pc.red("✖ Falha na leitura profunda de página:"), pageResult);
    process.exit(1);
  }

  console.log(pc.bold(pc.green("Todos os testes passaram com sucesso! 🚀\n")));
}

runTests().catch((err) => {
  console.error("Erro fatal no teste:", err);
  process.exit(1);
});
