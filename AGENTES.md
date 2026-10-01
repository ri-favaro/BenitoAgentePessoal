# 🤖 Guia de Desenvolvimento & Instruções para Agentes (AGENTES.md)

Este documento orienta desenvolvedores e agentes de IA (Antigravity, Claude, Copilot, etc.) que forem trabalhar na manutenção, evolução e expansão do repositório do **Benito**.

---

## 📌 Visão Geral & Filosofia do Projeto

- **Objetivo:** O **Benito** é um assistente pessoal local inteligente focado em engenharia de software, organização e produtividade para o usuário (**Luiz Ricardo**).
- **Princípio Arquitetural:** **Extrema leveza e simplicidade.**
  - O runtime do agente roda em Node.js (TypeScript) consumindo menos de 50 MB de RAM.
  - Não adicione frameworks pesados ou inflados de IA (como LangChain Python ou orquestradores pesados).
  - Use o **Vercel AI SDK (`ai`)** para tool calling, streaming e conexões de providers.
- **Princípio de Ouro: Flexibilidade Cognitiva & Zero "Hardcoding":**
  - **O código TypeScript provê infraestrutura neutra e guardrails:** cuida de tipagem estrita (Zod), rede, segurança, prevenção de loops infinitos, cache de falhas e integridade do processo.
  - **NUNCA faça remendos *hardcoded* no código:** é expressamente proibido adicionar regexes semânticas, dicionários manuais de sinônimos ou substituições ad-hoc no TypeScript (ex: tentar substituir "last race" por "recent race" ou cortar "location and date" via regex). Isso engessa o agente e cria dívida técnica frágil.
  - **Regras Universais de Prompt vs. Overfitting de Sintoma:** Ao orientar o modelo, nunca crie regras hiper-específicas para o último erro pontual (ex: não crie um gatilho exclusivo para "modelos LLM", mas sim um princípio universal de *Informação Dinâmica/Volátil* que cubra qualquer domínio em rápida evolução).
  - **Zero "Memória Fóssil" (Dados Perecíveis na Memória de Longo Prazo):** A memória persistente (`memory/*.md`) deve conter fatos duradouros (perfil do usuário, hardware físico, preferências e restrições de engenharia). **NUNCA grave listas estáticas de dados altamente voláteis** (ex: lista fixa de "melhores modelos do mercado"). A memória deve registrar a restrição (ex: física de 12GB VRAM), e o agente deve descobrir os itens dinamicamente na web.
  - O objetivo é sempre **tornar o agente mais inteligente, flexível e escalável**, nunca engessá-lo com amarras de código ou memórias obsoletas.
- **Hardware do Usuário:** PC com **RTX 4070 Ti (12GB VRAM)**. O modelo padrão recomendado para alta fidelidade em tool calling e raciocínio multimodal é o **Qwen 3.5 9B** (com contexto expandido de 24k tokens, `qwen3.5:9b-24k`) rodando localmente via **Ollama** a ~65-90 tok/s ocupando apenas 6.3 GB de VRAM com 100% de offload na GPU. O **Qwen 3.5 4B** permanece como alternativa ultrarrápida (>120 tok/s).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Linguagem** | TypeScript 5.8+ (ES2022, NodeNext) | Tipagem estrita e módulos ESM nativos |
| **Runtime de Execução** | Node.js 22+ & `tsx` | Execução rápida sem build prévio |
| **Orquestrador de IA** | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) | Streaming, tool calling e structured output |
| **LLM Local Primária** | Ollama (`http://localhost:11434/v1`) | Qwen 3.5 9B (24k) / Qwen 2.5 14B (ou 4B/7B) |
| **LLM Cloud Fallback** | Google AI Studio Free Tier | Gemini 1.5 Flash (contexto de 1M tokens) |
| **Sistema de Memória** | Markdown Local (`memory/*.md`) | Memória humana, legível, auditável e editável |
| **Validação de Schemas**| Zod (`zod`) | Tipagem estrita dos parâmetros das ferramentas |

---

## 📂 Mapa da Estrutura de Arquivos

```
BenitoAgentePessoal/
├── AGENTES.md                # Este guia para desenvolvedores e agentes de IA
├── README.md                 # Documentação pública do projeto
├── package.json              # Dependências e scripts (test, test:search, test:memory)
├── tsconfig.json             # Configuração estrita do compilador TS
├── .env / .env.example       # Variáveis de ambiente (provedores e endpoints)
├── docker-compose.yml        # Subida do SearXNG local com mapeamento de porta
├── searxng/
│   └── settings.yml          # Configurações do SearXNG (JSON API)
├── memory/
│   ├── profile.md            # Perfil do Luiz Ricardo (stack, hardware, fatos aprendidos)
│   ├── rules.md              # Identidade do Benito, diretrizes de resposta e honestidade
│   ├── learnings.md          # Lições aprendidas e feedbacks operacionais persistidos
│   └── topics/               # Memória modular especializada em subpastas
│       ├── web-search.md     # Diretrizes universais de busca web e leitura profunda
│       ├── sports.md         # Regras específicas de eventos esportivos e cronologia
│       └── local-ai.md       # Diretrizes de IA local, limites de VRAM (12GB) e tool calling
├── tests/
│   ├── test-search.ts        # Testes de integração da busca web, anti-loop e sanitização
│   └── test-memory.ts        # Testes da memória modular, tool calling e consolidação com histórico
└── src/
    ├── config.ts             # Leitura centralizada de variáveis de ambiente
    ├── cli.ts                # Terminal interativo com streaming, cores e comandos
    ├── core/
    │   ├── agent.ts          # Loop do agente (streamText, histórico, maxSteps, poda de RAM/VRAM)
    │   └── llm.ts            # Factory de providers (Ollama, llama-server ou Gemini)
    ├── memory/
    │   └── memory-manager.ts # Leitura de regras, perfil, tópicos e consolidação com sessão ativa
    └── tools/
        ├── index.ts          # Registro central onde todas as tools são expostas
        ├── filesystem-tools.ts # Criação, leitura e listagem de arquivos (ex: Obsidian)
        ├── memory-tools.ts   # Gravação de fatos (profile), aprendizados (learnings) e persona (rules)
        └── web-tools.ts      # Ferramentas de busca (SearXNG), leitura profunda e cache anti-loop
```

---

## 🧠 Como Funciona o Sistema de Memória

A memória do Benito é dividida em três camadas cognitivas com suporte a modularidade, otimização de VRAM e consolidação inteligente:

1. **Memória de Curto Prazo (RAM / Working Memory) com Podagem Otimizada:**
   * O array `messages: CoreMessage[]` mantido em memória dentro da classe `PersonalAgent` durante a execução da CLI.
   * **Podagem Automática de VRAM (`pruneOldMessages`):** Resultados brutos de ferramentas antigas (como páginas web de 8.000 caracteres) têm seu conteúdo truncado após 2 turnos para ~600 caracteres. Uma janela deslizante impede que o histórico ultrapasse 30 mensagens, mantendo a janela de contexto do Ollama enxuta (~2k a 4k tokens) e evitando consumo excessivo de memória/VRAM (evitando subir para 8 GB+).
   * É limpo manualmente quando o usuário usa `/limpar` ou encerra o processo com `/sair`.
2. **Memória de Longo Prazo Principal (Disco / Markdown):**
   * **`memory/profile.md`:** Guarda informações biográficas sobre o Luiz Ricardo, suas tecnologias favoritas, notas de projetos e preferências aprendidas via ferramenta `save_memory`.
   * **`memory/rules.md`:** Guarda as diretrizes comportamentais, o nome oficial (Benito) e o tom de voz. Atualizado via ferramenta `update_persona`.
   * **`memory/learnings.md`:** Guarda lições aprendidas, feedbacks corretivos e regras procedurais transversais gerais ensinadas pelo usuário. Atualizado via ferramenta `save_learning`.
   * **Âncora Temporal e Relógio em Tempo Real:** A cada turno, o `MemoryManager.buildSystemPrompt()` lê os arquivos atualizados do disco e injeta dinamicamente a data, ano e **horário atual do sistema**, além de instruções estritas de ordenação cronológica e completude de respostas.
3. **Memória Modular Especializada por Tópicos (`memory/topics/*.md`):**
   * Subpasta com arquivos dedicados por domínio (ex: `web-search.md`, `sports.md`, `coding.md`).
   * Mantém o prompt enxuto e escalável: em vez de injetar dezenas de regras específicas no prompt principal, o agente carrega apenas um índice compacto com 1 linha por tópico (`readAllTopicsIndex()`).
   * Ferramentas dedicadas: `read_topic_memory`, `save_topic_learning` e `list_memory_topics`.
4. **Ciclo de Consolidação Inteligente de Memória (`/consolidar`):**
   * O comando `/consolidar` agora recebe o histórico real da conversa da sessão ativa (`agent.getHistory()`).
   * O método `MemoryManager.consolidateMemory()` analisa a conversa recente, extrai fatos novos, ideias de projetos (ex: integrações com GitHub), preferências e decisões operacionais, e os mescla de forma limpa aos arquivos Markdown em disco.
   * Gera um resumo **dinâmico e contextual** informando com precisão o que foi aprendido no diálogo ou se a memória existente foi apenas mantida e revisada.

---

## 🌐 Como Funciona a Busca Web & Leitura Profunda

O Benito adota uma arquitetura inspirada em motores modernos de pesquisa de agentes (Perplexity, ChatGPT Search, Tavily) com proteções ativas contra loops e alucinações em `src/tools/web-tools.ts`:

1. **Passo 1: `search_web` (Descoberta & Mapeamento):**
   * **Provedor Primário Recomendado (Tavily AI Search):** Se `TAVILY_API_KEY` estiver configurada no `.env`, o Benito consulta a API da **Tavily** (`https://api.tavily.com/search`). A Tavily já renderiza a web, extrai o texto limpo sem poluição de anúncios e entrega uma resposta direta sintetizada (`answer`) acompanhada dos resultados e links.
   * **Provedor Local Fallback (SearXNG via Docker):** Se a chave da Tavily não estiver presente ou `SEARCH_PROVIDER=searxng`, consulta o **SearXNG** local (porta 8080) usando categorias combinadas (`general,news`).
   * **Sanitização Estrutural Neutra (`sanitizeSearchQuery`):** Limpeza puramente neutra de pontuação conversacional solta (`?`, `!`, `;`, `:`), aspas desbalanceadas e colapso de espaços em branco, sem regras semânticas manuais ou substituição de vocabulário.
   * **Formulação Factual por Palavras-Chave (Keyword Search):** Instruído no schema Zod e nos prompts para formular substantivos factuais de desfecho (`results`, `winner`, `standings`, `calendar`, `release`), evitando perguntas prolixas conversacionais (como `last race location`).
   * **Expansão de Siglas Curtas:** Siglas de 2 a 3 letras (`F2`, `FE`, `WEC`) são expandidas (`Formula 2`, `Formula E`) para evitar colisões com teclas e dicionários.
   * **Regra Universal de Idioma:** Para assuntos técnicos, programação, benchmarks, hardware, simuladores/jogos e eventos globais, a busca é formulada prioritariamente em **inglês**, traduzindo a resposta para pt-BR. O português é mantido apenas para assuntos estritamente regionais do Brasil.
   * **Guarda Anti-Repetição de Query:** Bloqueia automaticamente buscas idênticas consecutivas na mesma etapa, forçando o modelo a variar termos ou acionar a leitura de links já obtidos.

2. **Passo 2: `fetch_web_page` (Leitura Profunda com Jina Reader & Fallback):**
   * **Renderização Headless de SPAs (Jina Reader - `r.jina.ai`):** O Benito tenta ler a página primeiramente via **Jina Reader** (`https://r.jina.ai/<url>`), que executa o JavaScript de páginas modernas (React, Next.js, portais esportivos como `formula1.com` e `ge.globo.com`) e extrai o Markdown limpo e integral com tabelas completas.
   * **Fallback Transparente Local:** Se o Jina Reader falhar ou tiver timeout, faz o fallback automático para a requisição HTTP direta com `extractPageText(html)`.
   * **Protocolo Mandatório Search ➔ Fetch para Turnês e Agendas:** Snippets de busca são resumos truncados de 2 linhas que omitem dias exatos ou misturam eventos secundários (ex: filmes). Para perguntas sobre datas de shows, turnês e cronogramas, o agente **deve obrigatoriamente acionar `fetch_web_page`** na matéria para extrair o itinerário real.
   * **Proibição de Alucinar Dias:** Se o snippet indicar apenas o mês (ex: "em outubro"), é proibido inventar um dia da cabeça. O agente deve abrir a página com `fetch_web_page`.
   * **Proibição de Evasividade ("Anti-Lazy Assistant"):** É vedado responder dizendo *"verifique no site oficial ou na página de ingressos"*. O agente deve abrir os links e entregar os dados prontos.
   * **Estado de Sessão & Proteção Anti-Loop (`WebToolsSessionState`):**
     * Registra URLs conhecidas da busca recente, visitadas e falhadas.
     * **Cache de URLs Falhadas (`failedUrls`):** Se uma URL falhar (DNS/404/timeout), futuras tentativas de consultar essa mesma URL são bloqueadas imediatamente, impedindo o modelo de travar em re-tentativas inúteis.
     * **Guarda Anti-Alucinação Estrita:** Bloqueia com erro formal qualquer tentativa do modelo de inventar links da imaginação que não constem na lista de resultados reais retornada pelo `search_web`.

3. **Guarda de Síntese Final Obrigatória (`src/core/agent.ts`):**
   * Quando o ciclo de passos atinge o limite (`maxSteps: 5`) ou se a última mensagem do ciclo for de ferramenta (`role: "tool"`), o agente dispara compulsoriamente uma chamada de síntese sem ferramentas. Isso elimina o bug de o Benito "ficar mudo" ou cortar frases no meio, garantindo sempre a resposta final ao usuário e proibindo simulações de "vou acessar".

4. **Raciocínio Cronológico, Futuro Estrito & Sanity Check de Datas:**
   * **Regra Matemática do "Próximo" Evento (Futuro Estrito):** A data de qualquer evento qualificado como "próximo" DEVE ser maior que a data atual do sistema. Se uma notícia contiver data passada (ex: 28 de setembro quando hoje é 1 de outubro), o evento já passou e não pode ser o próximo.
   * **Diferenciação Semântica:** Shows/concertos presenciais ao vivo em estádios/arenas não se confundem com transmissões de filmes gravados em salas de cinema.
   * **Ordenação Estrita:** Toda lista de eventos deve ser ordenada do menor para o maior (dia 1 -> dia 2 -> dia 7).
   * **Tratamento de Temporadas Quebradas:** Para campeonatos bianuais (ex: Fórmula E, NBA), se o ano atual não trouxer resultados concluídos, nunca force anos futuros.

---

## 🔧 Como Criar uma Nova Ferramenta (Tool)

Ao adicionar uma nova ferramenta para o Benito:

1. **Crie um novo arquivo ou adicione ao módulo correspondente em `src/tools/`:**
   ```typescript
   import { tool } from "ai";
   import { z } from "zod";

   export function createMinhaNovaTool() {
     return {
       minha_ferramenta: tool({
         description: "Descrição clara e inequívoca do que a ferramenta faz.",
         parameters: z.object({
           parametro: z.string().describe("Explicação do parâmetro"),
         }),
         execute: async ({ parametro }) => {
           try {
             // Lógica da ferramenta
             return { success: true, data: "resultado" };
           } catch (error) {
             const msg = error instanceof Error ? error.message : String(error);
             return { success: false, error: msg };
           }
         },
       }),
     };
   }
   ```
2. **Registre no centralizador `src/tools/index.ts`:**
   ```typescript
   export function getAgentTools(memoryManager: MemoryManager) {
     return {
       ...createMemoryTools(memoryManager),
       ...createFilesystemTools(),
       ...createMinhaNovaTool(), // <-- adicione aqui
     };
   }
   ```
3. **Adicione feedback visual no terminal (`src/cli.ts`):**
   No callback `onToolCall`, adicione um bloco `else if (toolName === "minha_ferramenta")` para exibir uma mensagem colorida ao usuário quando a tool for acionada.
4. **Atualize as regras (`memory/rules.md`):**
   Se for uma ferramenta essencial para o fluxo de trabalho (como integração com Obsidian ou busca na web), documente em `rules.md` quando o Benito deve acioná-la.

---

## 📜 Convenções de Git e Código

- **Commits:** Mensagens sempre em **Português do Brasil (pt-br)** com prefixos de Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Segurança:** **NUNCA** commite arquivos `.env`, chaves de API, credenciais ou notas confidenciais. O `.gitignore` deve sempre ignorar `.env`, `dist/` e `node_modules/`.
- **Validação:** Antes de commitar, sempre execute:
  ```powershell
  npm run build
  ```
  Garantindo que não existam erros de compilação do TypeScript.

---

## 🚀 Próximas Funcionalidades Sugeridas no Roadmap

1. **[Concluído] Busca na Web & Leitura Profunda (SearXNG via Docker):** Ferramentas `search_web` e `fetch_web_page` com proteções anti-loop, sanitização temporal e heurística universal de idioma.
2. **[Em Backlog - Issue #7] Gestão de Backlog no GitHub (`create_github_issue`):** Capacidade de o Benito refletir sobre suas próprias limitações e, sob autorização do usuário, abrir issues no repositório GitHub (`ri-favaro/BenitoAgentePessoal`).
3. **Interface Telegram (grammY):** Criar um módulo opcional para conversar com o Benito pelo celular via bot do Telegram.
4. **Busca Semântica no Obsidian (RAG Local):** Indexar notas do Obsidian usando embeddings locais (`nomic-embed-text` ou `bge-m3` via Ollama) com LanceDB ou SQLite.
