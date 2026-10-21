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
    console.log(pc.green("✔ Formatador SearXNG gerou markdown com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha no formatador SearXNG:"));
    console.log(mockFormatted);
    process.exit(1);
  }

  const { formatTavilyResults } = await import("../src/tools/web-tools.js");
  const mockTavily = formatTavilyResults(
    {
      query: "F1 2026",
      answer: "Resposta sintetizada pela Tavily AI.",
      results: [
        {
          title: "F1 Oficial",
          url: "https://formula1.com",
          content: "Conteúdo detalhado retornado pela Tavily.",
        },
      ],
    },
    5
  );

  if (
    mockTavily.includes("Resposta Direta da Busca (Tavily AI)") &&
    mockTavily.includes("Resposta sintetizada pela Tavily AI.") &&
    mockTavily.includes("F1 Oficial")
  ) {
    console.log(pc.green("✔ Formatador Tavily AI validado com sucesso!\n"));
  } else {
    console.error(pc.red("✖ Falha no formatador Tavily AI:"), mockTavily);
    process.exit(1);
  }

  const { config } = await import("../src/config.js");
  const initialProvider = config.searchProvider;

  // Teste Tavily Live se chave presente
  if (config.tavily.apiKey) {
    console.log(pc.yellow("1.1 Testando busca real via Tavily AI Search API..."));
    config.searchProvider = "tavily";
    const tavilyLive = await tools.search_web.execute(
      { query: "Node.js JavaScript", numResults: 2 },
      { messages: [], toolCallId: "test-tavily-live" }
    );
    if (tavilyLive.success && tavilyLive.summary) {
      console.log(pc.green("✔ Busca real via Tavily AI Search retornou dados com sucesso!\n"));
    } else {
      console.error(pc.red("✖ Falha na busca real via Tavily:"), tavilyLive);
      process.exit(1);
    }

    console.log(pc.yellow("1.2 Testando busca de notícias recentes no Tavily (topic: 'news', days: 3)..."));
    const tavilyNews = await tools.search_web.execute(
      { query: "Artificial Intelligence", numResults: 2, topic: "news", days: 3, timeRange: "day" },
      { messages: [], toolCallId: "test-tavily-news" }
    );
    if (tavilyNews.success && tavilyNews.summary) {
      console.log(pc.green("✔ Busca de notícias recentes via Tavily retornou matérias com sucesso!\n"));
    } else {
      console.error(pc.red("✖ Falha na busca de notícias recentes via Tavily:"), tavilyNews);
      process.exit(1);
    }
  }

  // Força SearXNG para os testes locais do SearXNG (testes 2 a 5)
  config.searchProvider = "searxng";

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

  const isSearxngOffline =
    !searchResult.success && Boolean(searchResult.error?.includes("docker start searxng"));

  if (searchResult.success && searchResult.summary) {
    console.log(pc.green("\n✔ Busca no SearXNG executada com sucesso!"));
    console.log(pc.dim("\nPrévia do resumo formatado enviado para a LLM:"));
    console.log(pc.gray("--------------------------------------------------"));
    console.log(searchResult.summary);
    console.log(pc.gray("--------------------------------------------------"));
  } else if (isSearxngOffline) {
    console.log(
      pc.yellow(
        "\n⚠ SearXNG offline no host local (Docker inativo). Resiliência offline validada! Prosseguindo com fallback Tavily para testes ao vivo..."
      )
    );
  } else {
    console.error(pc.red(`\n✖ Falha na busca: ${searchResult.error}`));
    process.exit(1);
  }

  // Teste 3: Simulação de serviço offline
  console.log(pc.yellow("\n3. Testando comportamento amigável quando o SearXNG está offline..."));
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

  // Se o SearXNG estiver offline e Tavily estiver disponível, chaveia para Tavily para os testes seguintes
  if (isSearxngOffline && config.tavily.apiKey) {
    config.searchProvider = "tavily";
  }

  // Teste 4: Busca de notícias e eventos recentes (general,news)
  console.log(pc.yellow("4. Testando busca em tempo real com categorias 'general,news' ('Peugeot 9X8 Fuji')..."));
  const newsResult = await tools.search_web.execute(
    { query: "Peugeot 9X8 Fuji", numResults: 3, categories: "general,news" },
    { messages: [], toolCallId: "test-news" }
  );

  if (newsResult.success && (newsResult.summary?.toLowerCase().includes("fuji") || newsResult.summary?.toLowerCase().includes("peugeot"))) {
    console.log(pc.green("✔ Evento recente encontrado com sucesso usando general,news!\n"));
  } else if (isSearxngOffline && !config.tavily.apiKey) {
    console.log(pc.yellow("⚠ Pulando teste de notícias pois SearXNG está offline e Tavily não configurado.\n"));
  } else {
    console.error(pc.red("✖ Falha na busca de eventos recentes:"), newsResult);
    process.exit(1);
  }

  // Teste 5: Busca por palavras-chave factuais ('Google Gemini AI 2026')
  console.log(
    pc.yellow(
      "5. Testando busca por palavras-chave factuais ('Google Gemini AI 2026')..."
    )
  );
  const geminiResult = await tools.search_web.execute(
    { query: "Google Gemini AI 2026", numResults: 5 },
    { messages: [], toolCallId: "test-gemini" }
  );

  if (
    geminiResult.success &&
    geminiResult.summary?.toLowerCase().includes("gemini")
  ) {
    console.log(
      pc.green("✔ Busca factual encontrou resultados do Google Gemini com sucesso!\n")
    );
  } else if (isSearxngOffline && !config.tavily.apiKey) {
    console.log(pc.yellow("⚠ Pulando teste factual pois SearXNG está offline e Tavily não configurado.\n"));
  } else {
    console.error(pc.red("✖ Falha na busca factual do Gemini:"), geminiResult.summary);
    process.exit(1);
  }

  // Teste 6: Busca e Leitura profunda de página web legítima (fetch_web_page)
  console.log(pc.yellow("6. Testando busca e leitura profunda de página web legítima (fetch_web_page)..."));
  const btsSearch = await tools.search_web.execute(
    { query: "BTS World Tour Arirang Wikipedia", numResults: 1 },
    { messages: [], toolCallId: "test-search-bts" }
  );

  // Extrai a URL real respeitando links com parênteses como Wikipedia (ex: ..._(album))
  const urlMatch = btsSearch.summary?.match(/\((https?:\/\/.+?)\)\*\*/) ||
                   btsSearch.summary?.match(/\[.*?\]\((https?:\/\/[^\s]+(?:\([^\s)]+\))?[^\s)]*)\)/);
  const targetUrl = urlMatch ? urlMatch[1] : "https://pt.wikipedia.org/wiki/BTS_World_Tour_Arirang";
  const pageResult = await tools.fetch_web_page.execute(
    { url: targetUrl },
    { messages: [], toolCallId: "test-fetch-bts" }
  );

  if (pageResult.success && pageResult.content && pageResult.content.length > 200) {
    console.log(pc.green(`✔ Página lida com sucesso! Título: "${pageResult.title}"`));
    console.log(pc.dim(`Tamanho do texto extraído: ${pageResult.content.length} caracteres.\n`));
  } else {
    console.error(pc.red("✖ Falha na leitura profunda de página:"), pageResult);
    process.exit(1);
  }

  // Teste 7: Bloqueio estrito de URL alucinada/inventada (Guarda Anti-Alucinação)
  console.log(pc.yellow("7. Testando bloqueio estrito de URL alucinada/inventada..."));
  const hallucinatedUrl = "https://www.fiaformulae.com/season/2025-2026";
  const hallucinationResult = await tools.fetch_web_page.execute(
    { url: hallucinatedUrl },
    { messages: [], toolCallId: "test-hallucination" }
  );

  if (
    !hallucinationResult.success &&
    hallucinationResult.error?.includes("não consta nos resultados")
  ) {
    console.log(
      pc.green("✔ URL alucinada foi bloqueada com sucesso pela Guarda Anti-Alucinação!\n")
    );
  } else {
    console.error(pc.red("✖ Falha na Guarda Anti-Alucinação:"), hallucinationResult);
    process.exit(1);
  }

  // Teste 8: Bloqueio de URL falhada por erro de rede e proteção anti-loop
  console.log(pc.yellow("8. Testando bloqueio de URL falhada e proteção anti-loop..."));
  const { createWebToolsState } = await import("../src/tools/web-tools.js");
  const testState = createWebToolsState();
  const failingUrl = "https://www.dominio-que-certamente-nao-existe-1234567.com/falha";
  testState.knownUrls.add(failingUrl); // Simula que a busca encontrou um domínio quebrado
  const isolatedTools = createWebTools(testState);

  const firstFail = await isolatedTools.fetch_web_page.execute(
    { url: failingUrl },
    { messages: [], toolCallId: "test-fail-1" }
  );
  if (!firstFail.success && firstFail.error?.includes("bloqueada")) {
    console.log(pc.green("✔ Primeira tentativa falhou de rede e foi registrada no cache de falhas."));
  }

  const secondFail = await isolatedTools.fetch_web_page.execute(
    { url: failingUrl },
    { messages: [], toolCallId: "test-fail-2" }
  );
  if (!secondFail.success && secondFail.error?.includes("já foi consultada e falhou anteriormente")) {
    console.log(pc.green("✔ Segunda tentativa foi bloqueada IMEDIATAMENTE pela guarda anti-loop!\n"));
  } else {
    console.error(pc.red("✖ Falha na proteção anti-loop de URLs:"), secondFail);
    process.exit(1);
  }

  // Teste 9: Bloqueio de buscas idênticas consecutivas
  console.log(pc.yellow("9. Testando bloqueio de busca idêntica consecutiva..."));
  await tools.search_web.execute(
    { query: "Alpine A424 Fuji" },
    { messages: [], toolCallId: "test-dup-1" }
  );
  const duplicateSearch = await tools.search_web.execute(
    { query: "Alpine A424 Fuji" },
    { messages: [], toolCallId: "test-dup-2" }
  );
  if (!duplicateSearch.success && duplicateSearch.error?.includes("já realizou esta exata busca")) {
    console.log(pc.green("✔ Busca idêntica consecutiva foi bloqueada com sucesso!\n"));
  } else {
    console.error(pc.red("✖ Falha na detecção de busca duplicada:"), duplicateSearch);
    process.exit(1);
  }

  // Teste 10: Sanitização estrutural neutra (sem regex semântico hardcoded)
  console.log(pc.yellow("10. Testando sanitização estrutural neutra (aspas, pontuação '?' e espaços)..."));
  const { sanitizeSearchQuery } = await import("../src/tools/web-tools.js");
  const rawTestQuery = '  "Formula E" London ePrix results???   calendar:   ';
  const sanitized = sanitizeSearchQuery(rawTestQuery);

  if (sanitized === "Formula E London ePrix results calendar") {
    console.log(
      pc.green(`✔ Sanitizador estrutural neutro validado com sucesso! ("${sanitized}")\n`)
    );
  } else {
    console.error(pc.red("✖ Falha na sanitização estrutural neutra:"), sanitized);
    process.exit(1);
  }

  config.searchProvider = initialProvider;
  console.log(pc.bold(pc.green("Todos os testes de busca e ferramentas passaram com sucesso! 🚀\n")));
}

runTests().catch((err) => {
  console.error("Erro fatal no teste:", err);
  process.exit(1);
});
