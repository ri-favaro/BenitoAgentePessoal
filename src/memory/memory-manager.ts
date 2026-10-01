import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export class MemoryManager {
  private memoryDir: string;
  private profilePath: string;
  private rulesPath: string;
  private learningsPath: string;

  constructor(memoryDir: string = config.memoryDir) {
    this.memoryDir = memoryDir;
    this.profilePath = path.join(this.memoryDir, "profile.md");
    this.rulesPath = path.join(this.memoryDir, "rules.md");
    this.learningsPath = path.join(this.memoryDir, "learnings.md");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.memoryDir, { recursive: true });
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

  async buildSystemPrompt(): Promise<string> {
    const [rules, profile, learnings] = await Promise.all([
      this.readRules(),
      this.readProfile(),
      this.readLearnings(),
    ]);

    const now = new Date();
    const formattedDate = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentYear = now.getFullYear();

    return `
${rules}

---
# APRENDIZADOS OPERACIONAIS & FEEDBACKS DO USUÁRIO (SEGUI-LOS RIGOROSAMENTE)
${learnings}

---
# CONTEXTO E MEMÓRIA PERSISTENTE DO USUÁRIO (LUIZ RICARDO)
${profile}

---
# ÂNCORA TEMPORAL OBRIGATÓRIA DO SISTEMA
- Data de hoje: ${formattedDate}
- Ano corrente: ${currentYear}
- DIRETRIZ TEMPORAL: O ano atual é ${currentYear}. Para qualquer pergunta sobre "último(a)", "recente", "resultado", eventos esportivos (F1, WEC, etc.) ou lançamentos, assuma que estamos em ${currentYear} e SEMPRE inclua "${currentYear}" na sua busca web de primeira!
`.trim();
  }
}
