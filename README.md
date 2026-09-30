# 🤖 Nexus - Agente Pessoal Local

Um agente pessoal inteligente, modular e extensível construído em **TypeScript (Node.js)** com **Vercel AI SDK**, memória persistente baseada em arquivos Markdown e suporte nativo a LLMs locais via **Ollama** ou **llama.cpp** (`llama-server`), com opção de fallback gratuito para o **Google Gemini** (Google AI Studio).

---

## 🚀 Arquitetura & Diferenciais

- **Memória Transparente e Auditável:** Todos os fatos, regras e preferências ficam salvos em arquivos Markdown dentro de `memory/`. Você pode abrir no VS Code/Obsidian, ler ou editar manualmente a qualquer momento.
- **Tool Calling Automático:** O agente reconhece informações importantes sobre você e utiliza a ferramenta `save_memory` para salvar novos fatos sem você precisar pedir expressamente.
- **Leveza Extrema:** O backend consome menos de 50 MB de RAM.
- **Provider Agnóstico:** Roda localmente na sua **RTX 4070 Ti (12GB)** com o modelo recomendado **Qwen 2.5 7B (Q5_K_M)** a mais de 80 tokens/segundo.

---

## 📂 Estrutura do Projeto

```
ProjetoAgentePessoal/
├── memory/
│   ├── profile.md            # Seus dados, gostos, hardware e fatos aprendidos
│   └── rules.md              # Personalidade, tom de voz e regras operacionais
├── src/
│   ├── config.ts             # Configurações e variáveis de ambiente
│   ├── cli.ts                # Interface interativa de terminal (CLI)
│   ├── core/
│   │   ├── agent.ts          # Orquestrador central (histórico, streaming, tool loops)
│   │   └── llm.ts            # Conexão com Ollama, llama-server ou Gemini
│   ├── memory/
│   │   └── memory-manager.ts # Leitura e escrita dinâmica de memória
│   └── tools/
│       ├── index.ts          # Registro central de ferramentas
│       └── memory-tools.ts   # Ferramenta para salvar memórias persistentes
├── .env                      # Suas variáveis ativas
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

### 2. Configurar o Modelo Local (Ollama)
```powershell
# Iniciar o serviço do Ollama
ollama serve

# Baixar e testar o Qwen 2.5 7B
ollama run qwen2.5:7b
```

### 3. Iniciar o Agente
```powershell
npm run dev
```

---

## 💡 Comandos no Chat

- `/memoria` - Mostra o conteúdo atual que o agente lembra sobre você (`memory/profile.md`).
- `/limpar` - Limpa o histórico da sessão atual de conversa.
- `/sair` - Encerra o assistente.
- `/ajuda` - Exibe os comandos disponíveis.

