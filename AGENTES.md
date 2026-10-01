# 🤖 Guia de Desenvolvimento & Instruções para Agentes (AGENTES.md)

Este documento orienta desenvolvedores e agentes de IA (Antigravity, Claude, Copilot, etc.) que forem trabalhar na manutenção, evolução e expansão do repositório do **Benito**.

---

## 📌 Visão Geral & Filosofia do Projeto

- **Objetivo:** O **Benito** é um assistente pessoal local inteligente focado em engenharia de software, organização e produtividade para o usuário (**Luiz Ricardo**).
- **Princípio Arquitetural:** **Extrema leveza e simplicidade.**
  - O runtime do agente roda em Node.js (TypeScript) consumindo menos de 50 MB de RAM.
  - Não adicione frameworks pesados ou inflados de IA (como LangChain Python ou orquestradores pesados).
  - Use o **Vercel AI SDK (`ai`)** para tool calling, streaming e conexões de providers.
- **Hardware do Usuário:** PC com **RTX 4070 Ti (12GB VRAM)**. O modelo padrão recomendado para alta fidelidade em tool calling é o **Qwen 2.5 14B** (ou **Qwen 2.5-Coder 14B**) rodando localmente via **Ollama** a ~40 tok/s. O **Qwen 2.5 7B** permanece como alternativa ultrarrápida (>80 tok/s).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Linguagem** | TypeScript 5.8+ (ES2022, NodeNext) | Tipagem estrita e módulos ESM nativos |
| **Runtime de Execução** | Node.js 22+ & `tsx` | Execução rápida sem build prévio |
| **Orquestrador de IA** | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) | Streaming, tool calling e structured output |
| **LLM Local Primária** | Ollama (`http://localhost:11434/v1`) | Qwen 2.5 14B / Qwen 2.5-Coder 14B (ou 7B) |
| **LLM Cloud Fallback** | Google AI Studio Free Tier | Gemini 1.5 Flash (contexto de 1M tokens) |
| **Sistema de Memória** | Markdown Local (`memory/*.md`) | Memória humana, legível, auditável e editável |
| **Validação de Schemas**| Zod (`zod`) | Tipagem estrita dos parâmetros das ferramentas |

---

## 📂 Mapa da Estrutura de Arquivos

```
BenitoAgentePessoal/
├── AGENTES.md                # Este guia para desenvolvedores e agentes de IA
├── README.md                 # Documentação pública do projeto
├── package.json              # Dependências e scripts
├── tsconfig.json             # Configuração estrita do compilador TS
├── .env / .env.example       # Variáveis de ambiente (provedores e endpoints)
├── docker-compose.yml        # Subida do SearXNG local com mapeamento de porta
├── searxng/
│   └── settings.yml          # Configurações do SearXNG (JSON API)
├── memory/
│   ├── profile.md            # Perfil do Luiz Ricardo (stack, hardware, fatos aprendidos)
│   ├── rules.md              # Identidade do Benito, diretrizes de resposta e honestidade
│   └── learnings.md          # Lições aprendidas e feedbacks operacionais persistidos
├── tests/
│   └── test-search.ts        # Testes de integração da busca web e tratamento offline
└── src/
    ├── config.ts             # Leitura centralizada de variáveis de ambiente
    ├── cli.ts                # Terminal interativo com streaming, cores e comandos
    ├── core/
    │   ├── agent.ts          # Loop do agente (streamText, histórico, maxSteps)
    │   └── llm.ts            # Factory de providers (Ollama, llama-server ou Gemini)
    ├── memory/
    │   └── memory-manager.ts # Leitura de regras, perfil, nome dinâmico e escrita em MD
    └── tools/
        ├── index.ts          # Registro central onde todas as tools são expostas
        ├── filesystem-tools.ts # Criação, leitura e listagem de arquivos (ex: Obsidian)
        ├── memory-tools.ts   # Gravação de fatos (profile), aprendizados (learnings) e persona (rules)
        └── web-tools.ts      # Ferramenta de busca web em tempo real (SearXNG)
```

---

## 🧠 Como Funciona o Sistema de Memória

A memória do Benito é dividida em duas camadas:

1. **Memória de Curto Prazo (RAM):**
   * O array `messages: CoreMessage[]` mantido em memória dentro da classe `PersonalAgent` durante a execução da CLI. É limpo quando o usuário usa `/limpar` ou encerra o processo com `/sair`.
2. **Memória de Longo Prazo (Disco / Markdown):**
   * **`memory/profile.md`:** Guarda informações biográficas sobre o Luiz Ricardo, suas tecnologias favoritas, notas de projetos e preferências aprendidas via ferramenta `save_memory`.
   * **`memory/rules.md`:** Guarda as diretrizes comportamentais, o nome oficial (Benito) e o tom de voz. Atualizado via ferramenta `update_persona`.
   * **`memory/learnings.md`:** Guarda lições aprendidas, feedbacks corretivos e regras procedurais ensinadas pelo usuário (ex: incluir ano corrente em buscas de esportes). Atualizado via ferramenta `save_learning`.
   * **Montagem do Contexto & Âncora Temporal:** A cada mensagem, o `MemoryManager.buildSystemPrompt()` lê os arquivos atualizados do disco e injeta dinamicamente a data e ano atuais (`Data de hoje: ... | Ano corrente: 2026`) com instruções para ancoragem de buscas em tempo real.

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

1. **[Concluído] Busca na Web (SearXNG via Docker):** Ferramenta `search_web` integrada localmente sem custos de API e com privacidade.
2. **Interface Telegram (grammY):** Criar um módulo opcional para conversar com o Benito pelo celular via bot do Telegram.
3. **Busca Semântica no Obsidian (RAG Local):** Indexar notas do Obsidian usando embeddings locais (`nomic-embed-text` ou `bge-m3` via Ollama) com LanceDB ou SQLite.
