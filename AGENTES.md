# 🤖 Guia de Desenvolvimento & Instruções para Agentes (AGENTES.md)

Este documento orienta desenvolvedores e agentes de IA que forem trabalhar na manutenção, evolução e expansão do repositório do **Benito**.

---

## 📌 Visão Geral & Filosofia de Engenharia

- **Objetivo:** O **Benito** é um assistente pessoal local focado em engenharia de software, organização pessoal e produtividade para o usuário (**Luiz Ricardo**).
- **Extrema Leveza:** Runtime puro em Node.js (TypeScript ESM) com **Vercel AI SDK**. Não utilize frameworks pesados ou inflados de IA (como LangChain).
- **Princípio de Ouro: Zero Hardcoding Semântico:**
  - O código TypeScript provê **apenas infraestrutura neutra e guardrails**: tipagem estrita (Zod), controle de rede, sandbox de filesystem (`path-guard`), prevenção de loops e integridade do processo.
  - **NUNCA crie remendos semânticos hardcoded:** é proibido adicionar regexes conversacionais, dicionários de sinônimos ou substituições ad-hoc no TypeScript para consertar erros pontuais do modelo.
  - **Zero "Memória Fóssil":** A memória persistente (`memory/*.md`) deve guardar fatos duradouros e restrições (perfil, hardware físico, preferências). Nunca grave listas estáticas de dados perecíveis (ex: "melhores modelos do ano"). O agente deve pesquisar fatos dinâmicos na web.
- **Hardware de Referência:** PC com **RTX 4070 Ti (12GB VRAM)**. Modelo padrão: **Qwen 3.5 9B (24k)** local via Ollama (`qwen3.5:9b-24k`), com suporte a fallback para Google Gemini.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Linguagem & Runtime** | TypeScript 5.8+ (ESM nativo) / Node.js 22+ & `tsx` | Tipagem estrita e execução ágil |
| **Orquestrador de IA** | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`) | Streaming, tool calling e structured output |
| **LLMs Suportadas** | Ollama local (Qwen 3.5 9B/4B), llama-server ou Gemini Flash | Inferência local e fallback em nuvem |
| **Busca Web & Leitura** | Tavily AI Search (primário) / SearXNG (fallback) + Jina Reader | Busca factual e renderização profunda |
| **Interface & Acesso** | CLI interativa (terminal) e Telegram Bot (`grammy`) | Acesso local e remoto |
| **Segurança & Schemas** | Zod (`zod`) + `path-guard.ts` (sandbox) | Validação estrita de entradas e I/O em disco |

---

## 📂 Arquitetura & Onde Mexer

```
src/
├── core/             # Orquestração do agente (agent.ts) e factory de LLMs (llm.ts)
├── interfaces/       # Terminal interativo (cli.ts) e bot do Telegram (telegram.ts, telegram-utils.ts)
├── memory/           # MemoryManager (leitura de Markdown, tópicos modulares e /consolidar)
├── tools/            # Ferramentas expostas ao modelo (index.ts)
│   ├── web-tools.ts        # Busca web (Tavily/SearXNG), Jina Reader e cache anti-loop
│   ├── filesystem-tools.ts # Leitura/escrita de arquivos com sandbox
│   ├── finance-tools.ts    # Gestão financeira com carteiras (CC/VA), saldo mestre O(1) e conciliação no Obsidian
│   ├── path-guard.ts       # Validação e restrição de diretórios autorizados
│   └── memory-tools.ts     # Ferramentas para o modelo persistir fatos e aprendizados
tests/                # Suíte de testes automatizados (filesystem, finance, search, memory, telegram)
memory/               # Memória persistente do Benito (profile.md, rules.md, learnings.md, topics/)
```

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

## 📜 Convenções & Validação Obrigatória

- **Idioma de Commits:** Sempre em **Português do Brasil (pt-br)** com Conventional Commits (`feat:`, `fix:`, `chore:`, etc.).
- **Segurança:** **NUNCA** commite arquivos `.env`, chaves de API, credenciais ou dados pessoais do usuário.
- **Validação Local Obrigatória:** Antes de concluir qualquer tarefa, certifique-se de que os testes e a compilação passem:
  ```powershell
  npm run build
  npm test
  ```
