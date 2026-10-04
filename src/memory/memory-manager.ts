import fs from "node:fs/promises";
import path from "node:path";
import { generateText, type LanguageModel, type CoreMessage } from "ai";
import { config } from "../config.js";
import { getLanguageModel } from "../core/llm.js";

export interface MemoryTopic {
  slug: string;
  title: string;
  description: string;
  count: number;
}

export class MemoryManager {
  private memoryDir: string;
  private profilePath: string;
  private rulesPath: string;
  private learningsPath: string;
  private topicsDir: string;

  constructor(memoryDir: string = config.memoryDir) {
    this.memoryDir = memoryDir;
    this.profilePath = path.join(this.memoryDir, "profile.md");
    this.rulesPath = path.join(this.memoryDir, "rules.md");
    this.learningsPath = path.join(this.memoryDir, "learnings.md");
    this.topicsDir = path.join(this.memoryDir, "topics");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
    await fs.mkdir(this.topicsDir, { recursive: true });
  }

  async readProfile(): Promise<string> {
    try {
      return await fs.readFile(this.profilePath, "utf-8");
    } catch {
      return "# Perfil do Usuário\n\nNenhuma informação cadastrada ainda.";
    }
  }

  async readRules(): Promise<string> {
    try {
      return await fs.readFile(this.rulesPath, "utf-8");
    } catch {
      return "# Diretrizes\n\nVocê é o **Benito**, um assistente pessoal útil e conciso.";
    }
  }

  async readLearnings(): Promise<string> {
    try {
      return await fs.readFile(this.learningsPath, "utf-8");
    } catch {
      return "# Aprendizados Operacionais e Feedbacks\n\nNenhuma lição operacional registrada ainda.";
    }
  }

  async getAgentName(): Promise<string> {
    try {
      const rules = await this.readRules();
      const match =
        rules.match(/Você é o \*\*([^*]+)\*\*/i) ||
        rules.match(/Você é a? \*\*([^*]+)\*\*/i);
      return match ? match[1].trim() : "Benito";
    } catch {
      return "Benito";
    }
  }

  async updateAgentIdentity(options: {
    newName?: string;
    styleOrRule?: string;
  }): Promise<string> {
    await this.init();
    try {
      let rules = await this.readRules();

      if (options.newName) {
        if (/Você é o \*\*[^*]+\*\*/i.test(rules)) {
          rules = rules.replace(
            /Você é o \*\*[^*]+\*\*/i,
            `Você é o **${options.newName}**`
          );
        } else {
          rules = `Você é o **${options.newName}**.\n\n` + rules;
        }
      }

      if (options.styleOrRule) {
        const sectionHeader = "## Estilo e Tom de Voz";
        if (rules.includes(sectionHeader)) {
          rules = rules.replace(
            sectionHeader,
            `${sectionHeader}\n- ${options.styleOrRule}`
          );
        } else {
          rules += `\n\n## Estilo e Tom de Voz\n- ${options.styleOrRule}\n`;
        }
      }

      await fs.writeFile(this.rulesPath, rules, "utf-8");
      return `Identidade do agente atualizada com sucesso no disco! Nome atual: "${
        options.newName || (await this.getAgentName())
      }"`;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      return `Erro ao atualizar identidade do agente: ${err}`;
    }
  }

  async saveFact(fact: string, category?: string): Promise<string> {
    await this.init();
    const timestamp = new Date().toISOString().split("T")[0];
    const categoryTag = category ? `[${category}] ` : "";
    const entry = `\n- ${categoryTag}${fact} *(Registrado em: ${timestamp})*`;

    try {
      let content = await this.readProfile();
      const sectionHeader = "## Fatos e Notas Aprendidas";

      if (content.includes(sectionHeader)) {
        content = content.replace(
          sectionHeader,
          `${sectionHeader}${entry}`
        );
      } else {
        content += `\n\n${sectionHeader}${entry}\n`;
      }

      await fs.writeFile(this.profilePath, content, "utf-8");
      return `Fato registrado com sucesso na memória: "${fact}"`;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return `Erro ao salvar fato na memória: ${errMessage}`;
    }
  }

  async saveLearning(lesson: string, category?: string): Promise<string> {
    await this.init();
    const timestamp = new Date().toISOString().split("T")[0];
    const categoryTag = category ? `[${category}] ` : "";
    const entry = `\n- ${categoryTag}${lesson} *(Registrado em: ${timestamp})*`;

    try {
      let content = await this.readLearnings();
      content += entry;
      await fs.writeFile(this.learningsPath, content, "utf-8");
      return `Aprendizado operacional gravado com sucesso na memória persistente: "${lesson}"`;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return `Erro ao salvar aprendizado operacional: ${errMessage}`;
    }
  }

  async listTopics(): Promise<MemoryTopic[]> {
    await this.init();
    try {
      const files = await fs.readdir(this.topicsDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      const topics: MemoryTopic[] = [];

      for (const file of mdFiles) {
        const slug = file.replace(/\.md$/, "");
        const filePath = path.join(this.topicsDir, file);
        const content = await fs.readFile(filePath, "utf-8");

        const titleMatch = content.match(/^# (?:Tópico:\s*)?([^\n]+)/m);
        const title = titleMatch ? titleMatch[1].trim() : slug;

        const descMatch = content.match(/^(?:Descrição|Descricao):\s*([^\n]+)/m);
        const description = descMatch
          ? descMatch[1].trim()
          : "Diretrizes especializadas deste domínio.";

        const count = (content.match(/^\s*-\s+/gm) || []).length;

        topics.push({ slug, title, description, count });
      }

      return topics.sort((a, b) => a.slug.localeCompare(b.slug));
    } catch {
      return [];
    }
  }

  async readTopic(slug: string): Promise<string | null> {
    await this.init();
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filePath = path.join(this.topicsDir, `${cleanSlug}.md`);
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  async saveTopicLearning(
    slug: string,
    lesson: string,
    title?: string,
    description?: string
  ): Promise<string> {
    await this.init();
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filePath = path.join(this.topicsDir, `${cleanSlug}.md`);
    const timestamp = new Date().toISOString().split("T")[0];
    const newEntry = `- ${lesson} *(Registrado em: ${timestamp})*`;

    try {
      let content = "";
      try {
        content = await fs.readFile(filePath, "utf-8");
      } catch {
        content = `# Tópico: ${title || cleanSlug}\nDescrição: ${
          description || "Diretrizes e regras especializadas para este domínio."
        }\n\n`;
      }

      content = content.trimEnd() + "\n" + newEntry + "\n";
      await fs.writeFile(filePath, content, "utf-8");
      return `Regra gravada com sucesso no tópico modular '${cleanSlug}': "${lesson}"`;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      return `Erro ao salvar regra no tópico '${cleanSlug}': ${err}`;
    }
  }

  async readAllTopicsIndex(): Promise<string> {
    const topics = await this.listTopics();
    if (topics.length === 0) {
      return "- *(Nenhum tópico modular criado ainda. Use /consolidar ou save_topic_learning)*";
    }
    return topics
      .map(
        (t) =>
          `- **${t.slug}** (${t.title}): ${t.description} [${t.count} regra${
            t.count === 1 ? "" : "s"
          }]`
      )
      .join("\n");
  }

  private extractJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {}

    const codeblockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeblockMatch) {
      try {
        return JSON.parse(codeblockMatch[1]);
      } catch {}
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {}
    }

    throw new Error("Não foi possível decodificar JSON retornado pelo modelo.");
  }

  private formatSessionHistory(history?: CoreMessage[]): string {
    if (!history || history.length === 0) {
      return "Nenhum histórico de conversa recente nesta sessão.";
    }

    const lines: string[] = [];
    for (const msg of history) {
      if (msg.role === "system") continue;

      let textContent = "";
      if (typeof msg.content === "string") {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = msg.content
          .map((part: any) => {
            if (part && typeof part === "object") {
              if (typeof part.text === "string") return part.text;
              if (part.type === "tool-call") {
                return `[Ação solicitada: ${part.toolName}]`;
              }
            }
            return "";
          })
          .filter(Boolean)
          .join(" ");
      }

      // Remover eventuais instruções internas injetadas no histórico
      if (textContent.includes("[Instrução do Sistema:")) {
        textContent = textContent.replace(/\[Instrução do Sistema:[^\]]+\]/g, "").trim();
      }

      if (!textContent.trim()) continue;

      const speaker = msg.role === "user" ? "Luiz Ricardo (Usuário)" : "Benito (Agente)";
      lines.push(`${speaker}: ${textContent.trim()}`);
    }

    if (lines.length === 0) {
      return "Nenhum diálogo relevante na sessão recente.";
    }

    // Mantém até as últimas 25 mensagens para equilibrar riqueza de contexto e tokens
    return lines.slice(-25).join("\n\n");
  }

  async consolidateMemory(
    customModel?: LanguageModel,
    sessionHistory?: CoreMessage[]
  ): Promise<{ success: boolean; summary: string }> {
    await this.init();
    try {
      const [rules, profile, learnings, topics] = await Promise.all([
        this.readRules(),
        this.readProfile(),
        this.readLearnings(),
        this.listTopics(),
      ]);

      let existingTopicsText = "";
      for (const t of topics) {
        const content = await this.readTopic(t.slug);
        existingTopicsText += `\n--- TÓPICO: ${t.slug} (${t.title}) ---\n${content}\n`;
      }
      if (!existingTopicsText) {
        existingTopicsText = "Nenhum tópico existente ainda.";
      }

      const formattedSession = this.formatSessionHistory(sessionHistory);

      const prompt = `
Você é o Módulo Especialista de Consolidação e Arquitetura de Memória do Benito (assistente pessoal do Luiz Ricardo).

Seu objetivo é:
1. Analisar a CONVERSA DA SESSÃO ATUAL (se houver histórico abaixo) para identificar novos fatos biográficos, preferências, stacks, ideias de projetos, decisões técnicas ou aprendizados operacionais discutidos.
2. Integrar essas novidades à MEMÓRIA EXISTENTE EM DISCO, desduplicando, sintetizando e organizando tudo de forma modular em tópicos especializados.
3. Se a conversa não trouxe nenhuma informação de longo prazo relevante, preserve os dados existentes e relate isso com precisão no resumo.

---
### CONVERSA DA SESSÃO ATUAL:
${formattedSession}

---
### MEMÓRIA ATUAL EM DISCO:

=== PERFIL DO USUÁRIO (profile.md) ===
${profile}

=== APRENDIZADOS OPERACIONAIS GERAIS (learnings.md) ===
${learnings}

=== TÓPICOS MODULARES EXISTENTES (topics/*.md) ===
${existingTopicsText}

---
### SUAS DIRETRIZES DE CONSOLIDAÇÃO:
1. **Extração Inteligente da Conversa:**
   - Extraia planos, ideias discutidas (como novas ferramentas para o Benito, automações, GitHub, etc.), decisões arquiteturais e preferências do Luiz Ricardo.
   - Atualize 'consolidatedProfile' refletindo novos fatos, preferências ou projetos em andamento/planejados.
   - Extraia regras operacionais ou diretrizes de execução e as direcione para o tópico apropriado ou para os aprendizados gerais.

2. **Modularização por Tópicos Especializados (Subpastas memory/topics/<slug>.md):**
   - Agrupe regras técnicas e diretrizes por domínio (ex: 'web-search', 'sports', 'coding', 'github', etc.).
   - Você pode criar novos tópicos se o diálogo trouxer regras para novos domínios (ex: 'github' para regras de issues/repositório).
   - PRESERVE os tópicos e regras válidas já existentes, a menos que tenham sido revogadas.
   - Cada tópico no array deve conter:
     - "slug": identificador em minúsculas com hífens (ex: "web-search", "github")
     - "title": título amigável (ex: "Busca Web", "Integração GitHub")
     - "description": 1 linha com o propósito do tópico
     - "rules": array de strings com as diretrizes consolidadas do tópico (sem duplicatas).

3. **Sintetização de Aprendizados Gerais (memory/learnings.md):**
   - Mantenha em 'consolidatedLearnings' APENAS diretrizes transversais gerais de comportamento e tom de voz que se aplicam a toda conversa (máximo 4 a 6 itens mestres).
   - Não repita aqui o que já estiver modularizado dentro de tópicos específicos.

4. **Consolidação do Perfil (memory/profile.md):**
   - Mantenha organizado por seções claras (# Perfil do Usuário, ## Preferências, ## Projetos Atuais e Ideias).
   - Elimine dados redundantes e mantenha formatação Markdown limpa.

5. **Resumo da Consolidação (summary):**
   - Responda com um resumo REAL, DINÂMICO e ESPECÍFICO em português brasileiro.
   - Se houve novidades aprendidas na conversa recente, cite EXATAMENTE o que foi registrado (ex.: "Registrado no perfil a ideia de adicionar ferramenta do GitHub para abertura autônoma de issues...").
   - Se nenhuma nova informação foi identificada na conversa, declare claramente que a memória existente foi revisada e mantida íntegra.
   - NUNCA retorne um texto fixo ou genérico.

6. **FORMATO OBRIGATÓRIO DE RESPOSTA:**
   Responda EXCLUSIVAMENTE com um objeto JSON válido no formato abaixo, sem texto antes ou depois:
{
  "consolidatedLearnings": "# Aprendizados Operacionais e Feedbacks\\n\\n- ...",
  "consolidatedProfile": "# Perfil do Usuário\\n\\n...",
  "topics": [
    {
      "slug": "web-search",
      "title": "Busca Web e Pesquisa Online",
      "description": "Diretrizes e estratégias para busca e leitura profunda",
      "rules": [
        "Regra 1...",
        "Regra 2..."
      ]
    }
  ],
  "summary": "Resumo detalhado citando o que foi extraído da conversa ou revisado."
}
`.trim();

      const model = customModel || getLanguageModel();
      const response = await generateText({
        model,
        prompt,
        temperature: 0.1,
      });

      const parsed = this.extractJson(response.text);

      if (
        !parsed ||
        typeof parsed.consolidatedLearnings !== "string" ||
        typeof parsed.consolidatedProfile !== "string" ||
        !Array.isArray(parsed.topics)
      ) {
        throw new Error(
          "Formato JSON inválido retornado pelo modelo durante a consolidação."
        );
      }

      // Gravação segura das alterações
      await fs.writeFile(
        this.learningsPath,
        parsed.consolidatedLearnings.trim() + "\n",
        "utf-8"
      );
      await fs.writeFile(
        this.profilePath,
        parsed.consolidatedProfile.trim() + "\n",
        "utf-8"
      );

      for (const topic of parsed.topics) {
        if (!topic.slug || !Array.isArray(topic.rules)) continue;
        const cleanSlug = topic.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        const topicFilePath = path.join(this.topicsDir, `${cleanSlug}.md`);
        const topicContent = `# Tópico: ${topic.title || cleanSlug}
Descrição: ${topic.description || "Diretrizes especializadas deste domínio."}

${topic.rules.map((r: string) => `- ${r}`).join("\n")}
`;
        await fs.writeFile(topicFilePath, topicContent.trim() + "\n", "utf-8");
      }

      return {
        success: true,
        summary:
          parsed.summary ||
          "Memória sintetizada e organizada em tópicos com sucesso.",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        summary: `Erro ao consolidar memória: ${msg}`,
      };
    }
  }

  async buildSystemPrompt(): Promise<string> {
    const [rules, profile, learnings, topicsIndex] = await Promise.all([
      this.readRules(),
      this.readProfile(),
      this.readLearnings(),
      this.readAllTopicsIndex(),
    ]);

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const currentYear = now.getFullYear();

    return `
${rules}

---
# APRENDIZADOS OPERACIONAIS GERAIS (SEGUI-LOS RIGOROSAMENTE)
${learnings}

---
# TÓPICOS DE MEMÓRIA MODULAR ESPECIALIZADA (SUBPASTAS EM memory/topics/)
${topicsIndex}
*(Dica: Se a conversa envolver algum dos domínios acima com detalhes aprofundados, você pode consultar as regras completas usando a ferramenta \`read_topic_memory\` ou registrar novas usando \`save_topic_learning\`)*

---
# CONTEXTO E MEMÓRIA PERSISTENTE DO USUÁRIO (LUIZ RICARDO)
${profile}

---
# ÂNCORA TEMPORAL E DIRETRIZES DO SISTEMA
- Data de hoje: ${formattedDate}
- Horário atual do sistema: ${formattedTime} (Horário de Brasília / Local)
- Ano corrente: ${currentYear}
- Para perguntas sobre horário ou saudações, consulte EXCLUSIVAMENTE a âncora acima.
- O ano atual de referência é ${currentYear}. Para eventos, shows, campeonatos ou lançamentos, compare as datas encontradas com "${formattedDate}" para garantir futuro estrito.
- DIRETRIZ CRÍTICA DE MEMÓRIA (ZERO DADOS VOLÁTEIS): As ferramentas de memória persistente (save_memory, save_learning, save_topic_learning) são reservadas EXCLUSIVAMENTE para dados duradouros sobre o usuário Luiz Ricardo e regras/procedimentos operacionais. NUNCA salve em disco calendários de eventos, notícias, resultados de corridas/jogos, lançamentos de mercado ou tabelas de dados públicos. Fatos de domínio público e eventos externos devem ser SEMPRE pesquisados em tempo real na internet sob demanda via search_web.
- Responda sempre em Português do Brasil de forma direta, factual e sem evasivas. Se o usuário fizer uma pergunta com múltiplos requisitos, cubra a todos eles na resposta final.
`.trim();
  }
}

