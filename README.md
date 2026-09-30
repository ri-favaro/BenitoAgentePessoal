# 🤖 Benito - Agente Pessoal Local

Um assistente pessoal inteligente, modular e extensível construído em **TypeScript (Node.js)** com **Vercel AI SDK**, memória persistente baseada em arquivos Markdown e suporte nativo a LLMs locais via **Ollama** ou **llama.cpp** (`llama-server`), com opção de fallback gratuito para o **Google Gemini** (Google AI Studio).

---

## 🚀 Arquitetura & Diferenciais

- **Identidade e Nome Dinâmicos:** A personalidade e o nome do agente (Benito) são gerenciados no arquivo `memory/rules.md` e refletidos automaticamente na interface de terminal (CLI).
- **Memória Transparente e Auditável:** Todos os fatos, preferências de desenvolvimento e anotações ficam salvos em arquivos Markdown dentro de `memory/`. Você pode abrir no VS Code ou Obsidian, ler ou editar manualmente a qualquer momento.
- **Ferramentas de Arquivo (Integração com Obsidian):** O agente consegue criar, ler e listar notas reais no seu sistema de arquivos (por exemplo, no cofre `G:\CofreObsidian\AgentePessoal`) através das ferramentas `write_file`, `read_file` e `list_directory`.
- **Evolução Autônoma de Persona (`update_persona`):** Se você pedir para mudar o nome ou tom de voz, o Benito atualiza o arquivo `rules.md` no disco de forma permanente.
- **Extrema Leveza e Performance:** Backend consome menos de 50 MB de RAM. Roda localmente na **RTX 4070 Ti (12GB)** com o modelo **Qwen 2.5 7B (Q5_K_M)** a mais de 80 tokens/segundo.
- **Provider Agnóstico:** Protocolo compatível com OpenAI permite alternar entre Ollama local, llama-server ou Gemini Free Tier apenas alterando o `.env`.

---

## 📂 Estrutura do Projeto

```
BenitoAgentePessoal/
├── memory/
│   ├── profile.md            # Perfil do usuário (gostos, stack, hardware, fatos aprendidos)
│   └── rules.md              # Identidade ativa (Benito), tom de voz e regras operacionais
├── src/
│   ├── config.ts             # Configurações centralizadas via .env
│   ├── cli.ts                # Interface interativa de terminal com streaming e cores
│   ├── core/
│   │   ├── agent.ts          # Orquestrador central (histórico, streaming, tool loops)
│   │   └── llm.ts            # Conexão com Ollama, llama-server ou Gemini
│   ├── memory/
│   │   └── memory-manager.ts # Leitura e escrita dinâmica de memória e identidade
│   └── tools/
│       ├── index.ts          # Registro central de ferramentas
│       ├── filesystem-tools.ts # Criação, leitura e listagem de arquivos (Obsidian)
│       └── memory-tools.ts   # Gravação de fatos e atualização de persona
├── .env                      # Suas variáveis ativas (ignorado no git)
├── .env.example              # Exemplo de configuração
├── package.json
└── tsconfig.json
```

---

## 🛠️ Como Instalar e Rodar

### 1. Instalar as Dependências
```powershell
npm install
```

### 2. Iniciar o Modelo Local (Ollama)
Certifique-se de que o Ollama está rodando e baixe o modelo recomendado:
```powershell
# 1. Iniciar o serviço do Ollama
ollama serve

# 2. Baixar o modelo Qwen 2.5 7B (cerca de 4.7 GB)
ollama run qwen2.5:7b
```

*(Dica de performance no Windows: defina a variável de ambiente `OLLAMA_FLASH_ATTENTION=1` para ativar Flash Attention e economizar VRAM).*

### 3. Iniciar o Agente
```powershell
npm run dev
```

---

## 💡 Comandos no Chat

- `/memoria` — Mostra o que o Benito lembra sobre você (`memory/profile.md`).
- `/regras` — Exibe a identidade, regras e diretrizes ativas (`memory/rules.md`).
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
