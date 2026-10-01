# 🤖 Benito - Agente Pessoal Local

Um assistente pessoal inteligente, modular e extensível construído em **TypeScript (Node.js)** com **Vercel AI SDK**, memória persistente baseada em arquivos Markdown e suporte nativo a LLMs locais via **Ollama** ou **llama.cpp** (`llama-server`), com opção de fallback gratuito para o **Google Gemini** (Google AI Studio).

---

## 🚀 Arquitetura & Diferenciais

- **Identidade e Nome Dinâmicos:** A personalidade e o nome do agente (Benito) são gerenciados no arquivo `memory/rules.md` e refletidos automaticamente na interface de terminal (CLI).
- **Memória Transparente, Modular e Auditável:** Fatos, preferências e aprendizados ficam salvos em arquivos Markdown (`memory/*.md`) e divididos em tópicos especializados (`memory/topics/*.md`).
- **Consolidação Inteligente de Sessão (`/consolidar`):** O comando analisa a conversa recente em tempo real (`agent.getHistory()`), extrai novas preferências, planos e decisões técnicas, atualiza os arquivos em disco e gera um resumo dinâmico e contextual.
- **Busca Web com Tavily AI Search & SearXNG Fallback:** Integração de alto nível com a **Tavily Search API** (otimizada para agentes de IA com respostas diretas sintetizadas, tabelas e snippets ricos) e fallback automático para o **SearXNG** local (porta 8080). Inclui sanitização estrutural, bloqueio de buscas idênticas consecutivas, cache de URLs que falharam e a **Regra Universal de Idioma** (buscas prioritárias em inglês para dados técnicos/globais, entregando a resposta traduzida em Português).
- **Leitura Profunda com Jina Reader (`r.jina.ai`) & Anti-Alucinação Estrita (`fetch_web_page`):** O agente renderiza o JavaScript de páginas e portais modernos (SPAs em React/Next.js) via Jina Reader, extraindo o Markdown limpo e tabelas completas com fallback local, além do bloqueio estrito de URLs inventadas pelo modelo fora dos resultados reais da busca.
- **Guarda de Síntese Final Obrigatória:** O agente garante matematicamente a entrega de uma resposta conclusiva após o uso de ferramentas, impedindo que o modelo fique mudo ou trave caso atinja o teto de passos (`maxSteps: 5`).
- **Gerenciamento Eficiente de Contexto e VRAM:** Podagem automática de saídas de ferramentas antigas, condensação de Markdown com remoção de ruídos de imagem e janela deslizante suave, mantendo o Ollama rápido e leve na **RTX 4070 Ti (12GB)** com **Qwen 3.5 9B (24k)** ocupando apenas 6.3 GB de VRAM com 100% de offload na GPU.
- **Ferramentas de Arquivo (Integração com Obsidian):** Criação, leitura e listagem de notas reais no sistema de arquivos (`write_file`, `read_file`, `list_directory`).
- **Provider Agnóstico:** Suporte a Ollama local, llama-server (`llama.cpp`) ou Google Gemini Free Tier via `.env`.

---

## 📂 Estrutura do Projeto

```
BenitoAgentePessoal/
├── docker-compose.yml        # Orquestração do metabuscador SearXNG local
├── searxng/
│   └── settings.yml          # Configuração do SearXNG (JSON API habilitada)
├── memory/
│   ├── profile.md            # Perfil do usuário (gostos, stack, hardware, fatos aprendidos)
│   ├── rules.md              # Identidade ativa (Benito), tom de voz e regras operacionais
│   ├── learnings.md          # Lições aprendidas e feedbacks operacionais gerais
│   └── topics/               # Memória modular especializada por domínio
│       ├── web-search.md     # Diretrizes universais de busca web e leitura profunda
│       ├── sports.md         # Regras específicas de cronologia esportiva
│       └── local-ai.md       # Diretrizes de IA local, limites de VRAM (12GB) e tool calling
├── tests/
│   ├── test-search.ts        # Testes de busca web, sanitização e proteção anti-loop
│   ├── test-memory.ts        # Testes de memória modular e consolidação com histórico de sessão
│   └── test-telegram-utils.ts # Testes de utilitários do Telegram (whitelist, split de msgs)
├── src/
│   ├── config.ts             # Configurações centralizadas via .env
│   ├── cli.ts                # Interface interativa de terminal com streaming e cores
│   ├── interfaces/           # Interfaces externas de acesso ao agente
│   │   ├── telegram.ts       # Bot do Telegram (Long Polling, streaming e comandos)
│   │   └── telegram-utils.ts # Helpers de whitelist, quebra de mensagens e feedback de tools
│   ├── core/
│   │   ├── agent.ts          # Orquestrador central (streaming, tool calling, poda de VRAM)
│   │   └── llm.ts            # Conexão com Ollama, llama-server ou Gemini
│   ├── memory/
│   │   └── memory-manager.ts # Leitura e escrita dinâmica de memória e consolidação
│   └── tools/
│       ├── index.ts          # Registro central de ferramentas
│       ├── filesystem-tools.ts # Criação, leitura e listagem de arquivos (Obsidian)
│       ├── memory-tools.ts   # Gravação de fatos, tópicos e atualização de persona
│       └── web-tools.ts      # Busca na internet via SearXNG local e cache anti-loop
├── .env                      # Suas variáveis ativas (ignorado no git)
├── .env.example              # Exemplo de configuração
├── package.json              # Scripts de execução e testes automatizados
└── tsconfig.json
```

---

## 🛠️ Como Instalar e Rodar

### 1. Instalar as Dependências
```powershell
npm install
```

### 2. Iniciar o Modelo Local (Ollama)
Certifique-se de que o Ollama está rodando e baixe os modelos recomendados para a sua RTX 4070 Ti (12GB VRAM):

```powershell
# 1. Iniciar o serviço do Ollama
ollama serve

# 2. Baixar o modelo Qwen 2.5 14B (Geral e Produtividade - ~9 GB)
ollama run qwen2.5:14b

# 3. (Opcional) Baixar o modelo Qwen 2.5 Coder 14B (Especialista em Código/Engenharia - ~9 GB)
ollama run qwen2.5-coder:14b
```

#### 💡 Dica Crucial: Garantir Janela de Contexto (`num_ctx: 8192` ou `16384`)
Por padrão, o Ollama pode limitar o contexto a 2048 tokens se não configurado, o que pode causar perda de definições de ferramentas com prompts extensos. Para criar uma variante com contexto nativo de 8k ou 16k na sua VRAM:

```powershell
# Cria uma variante customizada com 8k de contexto no Ollama:
@"
FROM qwen2.5:14b
PARAMETER num_ctx 8192
"@ | ollama create qwen2.5:14b-8k -f -

# Para o Coder:
@"
FROM qwen2.5-coder:14b
PARAMETER num_ctx 8192
"@ | ollama create qwen2.5-coder:14b-8k -f -
```
Depois, basta apontar no `.env`: `OLLAMA_MODEL=qwen2.5:14b-8k` (ou `qwen2.5-coder:14b-8k`).

*(Dica de performance no Windows: defina a variável de ambiente `OLLAMA_FLASH_ATTENTION=1` para ativar Flash Attention e economizar VRAM).*

### 3. Iniciar o Metabuscador SearXNG (Opcional - Busca Web Local)
Para permitir que o Benito pesquise na internet em tempo real sem custos de API:

```powershell
# Subir o container SearXNG via Docker Compose (porta 8080)
docker compose up -d

# Ou se já possuir o container no Docker:
docker start searxng

# (Opcional) Executar todos os testes automatizados (busca web + memória + telegram):
npm test

# Ou individualmente:
npm run test:search
npm run test:memory
npm run test:telegram
```

### 4. Iniciar o Agente via Terminal (CLI)
```powershell
npm run dev
```

### 5. Iniciar o Agente via Telegram (Acesso Remoto pelo Celular)
Para conversar com o Benito de qualquer lugar pelo celular com acesso à mesma memória persistente e busca web:

1. **Criar o Bot no Telegram:**
   - Inicie uma conversa com o [@BotFather](https://t.me/BotFather) no Telegram.
   - Envie `/newbot`, escolha o nome do bot (ex: `Benito`) e um username (ex: `meu_benito_bot`).
   - Copie o token de acesso HTTP API gerado.
2. **Obter seu ID de Usuário:**
   - Inicie uma conversa com o [@userinfobot](https://t.me/userinfobot) no Telegram para ver seu `Id` numérico.
3. **Configurar no arquivo `.env`:**
   ```env
   TELEGRAM_BOT_TOKEN=seu_token_fornecido_pelo_botfather
   TELEGRAM_ALLOWED_USER_ID=seu_id_numerico
   ```
4. **Executar o Bot:**
   ```powershell
   npm run telegram
   ```
   *O bot se conecta automaticamente via Long Polling nativo (sem precisar abrir portas ou expor IP público), com streaming progressivo (debounce de 1.5s), whitelist estrita por ID e fila sequencial FIFO.*

---

## 💡 Comandos no Chat (CLI e Telegram)

- `/memoria` — Mostra o que o Benito lembra sobre você (`memory/profile.md`).
- `/regras` — Exibe a identidade, regras e diretrizes ativas (`memory/rules.md`).
- `/aprendizados` — Exibe as lições aprendidas e feedbacks operacionais gerais (`memory/learnings.md`).
- `/topicos` — Lista todos os tópicos de memória modular especializada (`memory/topics/`).
- `/topico <nome>` — Exibe o conteúdo de um tópico específico (ex: `/topico web-search`).
- `/consolidar` — Consolida a sessão ativa: analisa o diálogo recente em tempo real, extrai novas preferências, projetos e sintetiza regras nos tópicos em disco com resumo contextual.
- `/limpar` — Reseta a conversa atual sem perder a memória persistente.
- `/sair` — Encerra o assistente.
- `/ajuda` — Exibe os comandos disponíveis.

---

## 🔄 Alternando para o Google Gemini (Gratuito)

Caso queira usar a nuvem com contexto gigante de 1 milhão de tokens sem custos:
1. Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/).
2. No seu arquivo `.env`:
   ```env
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=sua_chave_do_aistudio
   GEMINI_MODEL=gemini-1.5-flash
   ```
3. Inicie com `npm run dev`.
