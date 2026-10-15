# 🤖 Guia de Desenvolvimento & Instruções para Agentes (AGENTS.md)

Este documento orienta desenvolvedores e agentes de IA que forem trabalhar na manutenção, evolução e expansão do repositório do **Benito**.

---

## 📌 Visão Geral & Filosofia de Engenharia

- **Objetivo:** O **Benito** é um assistente pessoal local focado em engenharia de software, organização pessoal e produtividade para o usuário (**Luiz Ricardo**).
- **Extrema Leveza:** Runtime puro em Node.js (TypeScript ESM) com **Vercel AI SDK**. Não utilize frameworks pesados ou inflados de IA (como LangChain).
- **Princípio de Ouro: Zero Hardcoding Semântico:**
  - O código TypeScript provê **apenas infraestrutura neutra e guardrails**: tipagem estrita (Zod), controle de rede, sandbox de filesystem (`path-guard`), prevenção de loops e integridade do processo.
  - **NUNCA crie remendos semânticos hardcoded:** é proibido adicionar regexes conversacionais, dicionários de sinônimos ou substituições ad-hoc no TypeScript para consertar erros pontuais do modelo.
  - **Zero "Memória Fóssil":** A memória persistente (`memory/*.md`) deve guardar fatos duradouros e restrições (perfil, hardware físico, preferências). Nunca grave listas estáticas de dados perecíveis (ex: "melhores modelos do ano"). O agente deve pesquisar fatos dinâmicos na web.
- **Hardware de Referência:** PC com **RTX 4070 Ti (12GB VRAM)**.
  - **Modelo LLM Padrão:** **Qwen 3.5 9B (24k)** local via Ollama (`qwen3.5:9b-24k`), com suporte a fallback para Google Gemini.
  - **Modelo de Embeddings Local:** **EmbeddingGemma-2 GGUF** (768 dimensões) local via `llama-server` na porta 8085 (`unsloth/embeddinggemma-2-GGUF`), otimizado para baixo consumo de memória (~270MB RAM).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Linguagem & Runtime** | TypeScript 5.8+ (ESM nativo) / Node.js 22+ & `tsx` | Tipagem estrita e execução ágil |
| **Orquestrador de IA** | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) | Streaming, tool calling e structured output |
| **LLMs Suportadas** | Ollama local (Qwen 3.5 9B/4B), llama-server ou Gemini Flash | Inferência local e fallback em nuvem |
| **Base Vetorial & RAG** | LanceDB (`@lancedb/lancedb`) + EmbeddingGemma-2 (768d) | Busca semântica local no codebase e cofre Obsidian |
| **Busca Web & Leitura** | Tavily AI Search (primário) / SearXNG (fallback) + Jina Reader | Busca factual e renderização profunda |
| **Interface & Acesso** | CLI interativa (paste burst) e Telegram Bot (`grammy`) | Acesso local no terminal e remoto via Telegram |
| **Gestão de Issues & Auto-Melhoria** | GitHub REST API + `SelfAuditor` | Registro de issues, auditoria de gargalos e auto-evolução |
| **Segurança & Schemas** | Zod (`zod`) + `path-guard.ts` (sandbox) | Validação estrita de entradas e I/O em disco |

---

## 📂 Arquitetura & Onde Mexer

```
src/
├── cli.ts            # Ponto de entrada CLI interativo (suporte a paste multi-linha)
├── config.ts         # Configuração centralizada e tipada do ambiente (.env)
├── core/             # Núcleo cognitivo e de infraestrutura
│   ├── agent.ts            # Orquestração do agente (PersonalAgent)
│   ├── llm.ts              # Provedores de modelo (Ollama, OpenAI-compatible, Gemini)
│   ├── reasoning-parser.ts # Streaming parser FSM (<thinking> / <think>)
│   ├── reasoning-logger.ts # Auditoria assíncrona em logs/reasoning.log (JSONL)
│   ├── embedding-service.ts# Cliente HTTP para llama-server (EmbeddingGemma-2 768d)
│   ├── vector-store.ts     # Persistência e busca vetorial com LanceDB (.lancedb/)
│   ├── indexer.ts          # Indexador incremental (chunking por AST/tópicos + hash SHA-256)
│   ├── github-service.ts   # Integração com GitHub REST API (issues/labels)
│   └── self-auditor.ts     # Auditoria de raciocínio, sandbox e cobertura de testes
├── interfaces/       # Adaptadores de comunicação e interface
│   ├── telegram.ts         # Bot do Telegram (comandos, streaming e gestão de sessão)
│   └── telegram-utils.ts   # SessionTracker (TTL por inatividade), autorização e split
├── memory/           # Gestão de memória persistente
│   └── memory-manager.ts   # Leitura de Markdown, tópicos modulares e /consolidar
├── orchestration/    # Orquestração técnica hierárquica e runners (Issue #21)
│   ├── terminal-runner.ts     # Runner seguro com whitelist de comandos e timeout
│   ├── task-packer.ts         # Empacotador de contexto (Issue + RAG + Regras de engenharia)
│   └── coding-orchestrator.ts # Orquestrador de delegação para AGY CLI e validação pós-execução
├── automation/       # Rotinas agendadas desacopladas (Issue #18)
│   ├── scheduler.ts           # TaskScheduler com expressões cron e trava de concorrência
│   └── jobs/                  # Jobs executáveis (daily-news-digest)
├── tools/            # Ferramentas expostas ao modelo (index.ts)
│   ├── web-tools.ts           # Busca web (Tavily/SearXNG), Jina Reader e cache anti-loop
│   ├── filesystem-tools.ts    # Leitura/escrita de arquivos com sandbox
│   ├── finance-tools.ts       # Gestão financeira com carteiras (CC/VA) e saldo mestre O(1)
│   ├── obsidian-tools.ts      # Second Brain com Daily Notes e tarefas (Issue #17)
│   ├── retrieval-tools.ts     # Busca semântica (search_codebase, search_vault, reindex_knowledge)
│   ├── github-tools.ts        # Gestão de issues, PRs e digest executivo (create_github_issue, create_github_pr, list_github_prs, summarize_github_pr, etc.)
│   ├── orchestration-tools.ts # Ferramentas para console e delegação ao AGY CLI (Issue #21)
│   ├── audit-tools.ts         # Auto-auditoria holística (run_self_audit)
│   ├── path-guard.ts          # Validação e restrição de diretórios autorizados
│   └── memory-tools.ts        # Ferramentas para o modelo persistir fatos e aprendizados
scripts/              # Utilitários de inicialização e manutenção
├── start-embedding-server.ps1 # Launcher do llama-server com consumo otimizado (270MB RAM)
└── index-knowledge.ts         # Script CLI para disparar indexação em lote (npm run index)
.lancedb/             # Armazenamento vetorial local embutido (tabelas: codebase, vault)
logs/                 # Auditoria contínua de raciocínio e intenções (reasoning.log JSONL)
tests/                # Suíte de testes automatizados (11 suítes com 100% de cobertura funcional)
memory/               # Memória persistente do Benito (profile.md, rules.md, learnings.md, topics/)
```

---

## 🧠 Padrão de Raciocínio Desacoplado & Intent Expansion (Decoupled Reasoning)

Ao manter ou evoluir a orquestração cognitiva do Benito:

1. **Monólogo Interno Obrigatório (`<thinking>...</thinking>`):**
   - Injetado no topo do `buildSystemPrompt()` (`memory-manager.ts`).
   - Força o modelo local (Qwen 9B) a desconstruir intenções implícitas, checar regras de segurança/sandbox/carteiras e traçar um plano de ação direto antes de agir ou responder.
2. **Streaming Parser com FSM (`src/core/reasoning-parser.ts`):**
   - O fluxo de tokens é desmembrado em tempo real sem adicionar latência.
   - Suporta `<thinking>` e `<think>` (compatível com modelos nativos como DeepSeek/QwQ), múltiplos blocos (`maxSteps`) e recuperação graciosa de tags não fechadas.
3. **Higienização de Memória & VRAM (`this.messages`):**
   - Mensagens salvas em `this.messages` NUNCA devem reter blocos `<thinking>`. Use sempre `stripThinking()` antes de gravar no histórico para poupar a janela de 24k da GPU.
4. **Auditoria Contínua (`src/core/reasoning-logger.ts`):**
   - Todo turno da conversa grava assincronamente em `logs/reasoning.log` no formato JSONL (`timestamp`, `userInput`, `thought`, `cleanResponse`, `durationMs`).
5. **Suporte a Colagem Multi-linha no CLI (`readInputWithPasteSupport`):**
   - O `readline` padrão do Node.js trunca no primeiro `\n`. O CLI utiliza `readInputWithPasteSupport` com detecção de *paste burst* para capturar blocos completos (questões com alternativas, código ou parágrafos) sem truncamento.

---

## 🔧 Padrões para Criação e Alteração de Ferramentas (Tools)

1. **Localização:** Crie ou edite o módulo dentro de `src/tools/` e registre a função em `src/tools/index.ts` (`getAgentTools`).
2. **Tipagem e Schemas:** Use sempre `tool()` do Vercel AI SDK com schemas `zod` estritos e descrições claras para cada parâmetro.
3. **Sandbox Obrigatória:** Qualquer ferramenta que leia ou grave arquivos no disco DEVE obrigatoriamente validar o caminho via `validatePathInsideAllowed` (`path-guard.ts`).
4. **Tratamento de Exceções:** Ferramentas nunca devem estourar exceções não tratadas; capture erros e retorne `{ success: false, error: msg }` para que o agente possa se recuperar.

---

## 💰 Módulo Financeiro & Arquitetura de Carteiras

Ao implementar, estender ou manter recursos em `src/tools/finance-tools.ts`:

1. **Snapshot Central em $O(1)$ (`Financas/saldo-mestre.md`):** É a única fonte da verdade do saldo cumulativo e patrimônio em tempo real. Nunca faça leituras encadeadas ou varreduras recursivas de notas passadas (`YYYY-MM.md`) para calcular saldos atuais.
2. **Sincronização Atômica:** Qualquer operação de escrita (`record_income`, `record_expense`, `cancel_last_transaction`, `adjust_wallet_balance`) DEVE atualizar tanto a nota do mês (`YYYY-MM.md`) quanto o `saldo-mestre.md`.
3. **Multi-Carteiras Dinâmico (Zero Hardcoding):** Carteiras são identificadas por chaves de string dinâmicas (`conta_corrente`, `va`, `vr`, etc.). Nunca utilize regras `switch/case` ou condicionais rígidos que impeçam o suporte a novas carteiras.
4. **Precisão em Ponto Flutuante:** Realize toda a matemática financeira convertendo valores em reais para centavos inteiros (`Math.round(val * 100)`), dividindo por 100 apenas na exibição ou persistência.
5. **Separação de Responsabilidades (Zero Poluição de Memória):** Diretrizes de comportamento do Benito sobre finanças ficam em `memory/rules.md`. NUNCA grave saldos, regras contábeis ou transações em `memory/profile.md` — finanças pertencem exclusivamente ao cofre de finanças e suas ferramentas.

---

## 🔍 Módulo de Busca Semântica & RAG (LanceDB + EmbeddingGemma-2)

Ao manter ou evoluir recursos de recuperação e embeddings em `src/core/` e `src/tools/retrieval-tools.ts`:

1. **Estrutura Dual de Conhecimento (`codebase` e `vault`):**
   - Tabela `codebase`: Fragmentos de código delimitados por escopo (funções, classes, rotas) de todos os repositórios autorizados em `ALLOWED_DIRECTORIES`.
   - Tabela `vault`: Seções estruturadas e títulos de notas Markdown no Cofre do Obsidian (`G:\CofreObsidian\AgentePessoal`).
2. **Indexação Incremental Baseada em SHA-256 (`KnowledgeIndexer`):**
   - O indexador calcula o hash SHA-256 de cada arquivo antes de reprocessar. Chunks inalterados são preservados, poupando processamento e mantendo a indexação ultrarrápida.
3. **Servidor de Embeddings Local Otimizado:**
   - O executável `llama-server` roda via `scripts/start-embedding-server.ps1` com o modelo `unsloth/embeddinggemma-2-GGUF` (768 dimensões) na porta 8085.
   - Utiliza flags `--ubatch 512`, `-c 2048`, `--embedding` para reduzir o consumo de memória RAM/VRAM de 9.3GB para apenas ~270MB.
4. **Filtro Estrito de Sandbox (`path-guard`):**
   - Todos os resultados de buscas vetoriais (`search_codebase` e `search_vault`) passam por `validateAllowedPath` antes de serem expostos ao modelo, garantindo isolamento total contra vazamento de arquivos sensíveis.

---

## 🚀 Auto-Melhoria, Gestão de Issues, PRs & Protocolo Human-in-the-Loop (GitHub)

Ao evoluir os módulos `src/core/self-auditor.ts`, `src/core/github-service.ts` e `src/tools/github-tools.ts`:

1. **Auto-Auditoria Holística (`run_self_audit`):**
   - O `SelfAuditor` monitora o arquivo `logs/reasoning.log` para calcular tempos médios de resposta e detectar gargalos de latência.
   - Realiza varreduras estáticas de cobertura comparando arquivos do `src/` com as suítes de `tests/`, apontando possíveis lacunas de teste (`testGaps`).
   - Verifica violações de sandbox e diretórios não autorizados.
2. **Distinção Estrita entre Issue e Pull Request (PR):**
   - **Issues (`create_github_issue`):** Itens de planejamento, débitos técnicos e propostas de novas capacidades. NUNCA recrie uma issue já existente.
   - **Pull Requests (`create_github_pr`):** Proposta de merge de código pronto de uma branch de feature para a branch base (`main`). NUNCA crie uma issue quando o usuário pedir para abrir um PR.
3. **Protocolo Estrito Human-in-the-Loop:**
   - **Regra Inviolável:** O Benito NUNCA cria issues ou PRs silenciosamente ou autonomamente no GitHub.
   - Ao identificar uma melhoria ou ao concluir uma branch, apresente no chat uma minuta objetiva (título em Conventional Commits e escopo) e solicite autorização explícita do Luiz Ricardo antes de disparar `create_github_issue` ou `create_github_pr`.
4. **Marca d'Água Padronizada no Body (Sem Emojis):**
   - Toda Issue criada pelo Benito recebe no rodapé: `> *Issue criada e registrada por Benito.*`
   - Todo PR criado pelo Benito recebe no rodapé: `> *Pull Request criado por Benito.*`

---

## 🛠️ Orquestração Técnica & Coding LLMs (Issue #21)

Ao manter ou evoluir recursos em `src/orchestration/` e `src/tools/orchestration-tools.ts`:

1. **Desacoplamento de Janelas de Contexto (Context Decoupling):**
   - O Benito opera com janela de 24k tokens no Qwen 9B local para especificação, supervisão e RAG sem ser sobrecarregado por arquivos gigantes.
   - O agente de coding (**AGY CLI**) roda em processo isolado (`agy --prompt "..." --dangerously-skip-permissions`), carregando árvores inteiras de código e executando lint/diff de forma autônoma sem travar no terminal pedindo confirmações.
2. **Defesa em Profundidade & Sandbox (`TerminalRunner`):**
   - **Whitelist de Comandos:** Apenas executáveis permitidos (`agy`, `npm`, `npx`, `git`, `node`, `gh`) podem ser executados pelo runner. Qualquer outro binário é bloqueado.
   - **Sandbox de CWD:** O diretório de execução deve ser validado via `validateAllowedPath` contra `ALLOWED_DIRECTORIES`.
   - **Controle de Timeout:** Comandos possuem tempo limite configurado (padrão 5 minutos / 300.000 ms) com abort gracioso para prevenir travamentos de terminal.
3. **Módulo de Context Packing (`TaskPacker`):**
   - Estrutura as instruções do AGY com seções padronizadas: Objetivo & Metadados da Issue, Requisitos, Diretrizes de Engenharia do Repositório, Snippets de Código via LanceDB e Critérios Obrigatórios de Entrega (branch dedicada, testes, Conventional Commits em pt-br e `git push -u origin <branch>`).
4. **Protocolo Estrito Human-in-the-Loop para Execução de Código:**
   - **Regra Inviolável:** O Benito NUNCA dispara a ferramenta `delegate_issue_to_coding_agent` em modo de execução real (`confirmedByUser: true`) sem apresentar a proposta e obter autorização expressa do Luiz Ricardo.
   - Suporta a flag `autoCreatePr: true` para, após o build passar com 100% de sucesso, sincronizar a branch no GitHub e abrir a Pull Request automaticamente com marca d'água.
   - Para prévias e inspeção de prompt estruturado, utilize sempre `prepare_coding_task` ou o parâmetro `dryRun: true`.

## 💬 Módulo do Telegram & Session Tracker (TTL de Inatividade)

Ao dar manutenção na interface do Telegram (`src/interfaces/telegram.ts` e `telegram-utils.ts`):

1. **Rastreamento de Inatividade (`SessionTracker`):**
   - A classe `SessionTracker` mantém o timestamp da última interação para cada chat autorizado.
   - O tempo limite é configurado via variável `SESSION_INACTIVITY_TIMEOUT_MINUTES` (padrão: 120 minutos / 2 horas).
2. **Expiração e Reset Automático de Sessão:**
   - Quando o usuário envia uma nova mensagem após o período de inatividade, o histórico recente (`PersonalAgent.messages`) é automaticamente resetado.
   - Uma mensagem informativa discreta é exibida no chat informando o início de uma nova sessão limpa, evitando contaminação de contexto entre dias ou tarefas desconexas.
3. **Comandos Integrados:**
   - O comando `/status` exibe as métricas de tempo decorrido e TTL configurado.
   - O comando `/limpar` reseta tanto o histórico do modelo quanto o temporizador do `SessionTracker`.

---

## 📜 Convenções, Scripts & Validação Obrigatória

### Comandos Úteis (`package.json`)

| Comando | Finalidade |
| :--- | :--- |
| `npm run dev` / `npm start` | Inicia o assistente na interface CLI interativa (terminal) |
| `npm run telegram` | Inicia o bot do Benito no Telegram |
| `npm run embedding:serve` | Inicia o servidor local do llama-server para embeddings (EmbeddingGemma-2) |
| `npm run index` | Dispara a indexação incremental do codebase e cofre Obsidian |
| `npm run build` | Compila o projeto com o TypeScript (`tsc`) |
| `npm test` | Executa a suíte completa de testes automatizados (todas as 11 suítes) |
| `npm run test:<nome>` | Executa uma suíte individual (`reasoning`, `filesystem`, `finance`, `search`, `memory`, `telegram`, `retrieval`, `audit`, `github`, `automation`, `obsidian`, `orchestration`) |

### Regras Gerais
- **Idioma de Commits:** Sempre em **Português do Brasil (pt-br)** com Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.).
- **Segurança:** **NUNCA** commite arquivos `.env`, chaves de API, credenciais ou dados pessoais do usuário.
- **Validação Local Obrigatória:** Antes de concluir qualquer tarefa, certifique-se de que a compilação passe e execute os testes pertinentes:
  ```powershell
  npm run build
  npm test
  ```
