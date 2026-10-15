import type { GitHubIssueDetail } from "../core/github-service.js";

export interface CodeContextSnippet {
  path: string;
  content: string;
  score?: number;
}

export interface PackTaskOptions {
  issue: GitHubIssueDetail;
  codeSnippets?: CodeContextSnippet[];
  additionalInstructions?: string;
  projectRules?: string[];
  branchName?: string;
}

export interface PackedTask {
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  branchName: string;
  prompt: string;
  contextSnippetsCount: number;
  estimatedPromptLength: number;
}

/**
 * TaskPacker estrutura o contexto técnico (issue + snippets de código + regras)
 * para alimentar a LLM de coding (ex: AGY CLI) com instruções claras e desacopladas.
 */
export class TaskPacker {
  private defaultProjectRules: string[] = [
    "Linguagem e Runtime: TypeScript 5.8+ (ESM nativo) no Node.js 22+. Tipagem estrita com Zod.",
    "Zero Hardcoding Semântico: Proibido criar regexes conversacionais ou substituições ad-hoc no TypeScript.",
    "Sandbox e Segurança: Qualquer operação de disco deve validar caminhos via validateAllowedPath (path-guard.ts).",
    "Padrão de Commits: Escrever mensagens de commit em português do Brasil (pt-br) com Conventional Commits (ex: feat:, fix:, chore:).",
    "Validação Local Obrigatória: Antes de finalizar, execute 'npm run build' e a suíte de testes relevante com 'npm test'.",
    "Branch Isolada: Trabalhe na branch designada. Nunca commite ou faça push direto na branch main/master.",
  ];

  constructor(customDefaultRules?: string[]) {
    if (customDefaultRules && customDefaultRules.length > 0) {
      this.defaultProjectRules = customDefaultRules;
    }
  }

  /**
   * Empacota uma issue e contexto técnico em um prompt estruturado para o AGY CLI.
   */
  packTask(options: PackTaskOptions): PackedTask {
    const { issue } = options;
    const branchName =
      options.branchName ||
      `feat/issue-${issue.number}-${this.slugify(issue.title)}`;
    const rules = options.projectRules || this.defaultProjectRules;
    const snippets = options.codeSnippets || [];

    const sections: string[] = [];

    // Cabeçalho e Objetivo
    sections.push(
      `# TAREFA DE IMPLEMENTAÇÃO: Issue #${issue.number} - ${issue.title}`,
      `**URL:** ${issue.url}`,
      `**Branch de Trabalho:** \`${branchName}\`\n`,
      `Você é o agente de programação responsável por implementar autonomamente a solução para esta issue.`
    );

    // Requisitos da Issue
    sections.push(
      `## 1. 📋 ESCOPO & REQUISITOS DA ISSUE`,
      issue.body.trim() || "Nenhuma descrição detalhada fornecida na issue."
    );

    // Regras do Projeto
    sections.push(
      `## 2. 🛡️ DIRETRIZES DE ENGENHARIA & REGRAS OBRIGATÓRIAS`,
      rules.map((r, i) => `${i + 1}. ${r}`).join("\n")
    );

    // Trechos de Código Relevantes (RAG)
    if (snippets.length > 0) {
      const snippetsFormatted = snippets
        .map((s, i) => {
          return `### Contexto ${i + 1}: \`${s.path}\`\n\`\`\`typescript\n${s.content.trim()}\n\`\`\``;
        })
        .join("\n\n");

      sections.push(
        `## 3. 🔍 CÓDIGO E COMPONENTES RELACIONADOS NO REPOSITÓRIO`,
        snippetsFormatted
      );
    }

    // Instruções Adicionais
    if (options.additionalInstructions && options.additionalInstructions.trim()) {
      sections.push(
        `## 4. 💡 DIRETRIZES ESPECÍFICAS DO TECH LEAD (BENITO)`,
        options.additionalInstructions.trim()
      );
    }

    // Instruções de Entrega & Validação
    sections.push(
      `## 5. Passos Obrigatórios para Conclusão`,
      `1. Se a branch \`${branchName}\` ainda não existir, crie-a a partir da branch base atual.`,
      `2. Implemente as alterações de código necessárias respeitando a arquitetura existente.`,
      `3. Crie ou atualize os testes unitários em \`tests/\` para garantir 100% de cobertura funcional.`,
      `4. Execute a compilação (\`npm run build\`) e a suíte de testes (\`npm test\`) para garantir que nada foi quebrado.`,
      `5. Realize o commit em português do Brasil seguindo Conventional Commits.`,
      `6. Faça o push seguro da branch para o origin (\`git push -u origin ${branchName}\`).`,
      `7. Nunca faça merge direto na branch principal (main/master). A Pull Request será aberta e avaliada pelo Luiz Ricardo.`
    );

    const fullPrompt = sections.join("\n\n");

    return {
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueUrl: issue.url,
      branchName,
      prompt: fullPrompt,
      contextSnippetsCount: snippets.length,
      estimatedPromptLength: fullPrompt.length,
    };
  }

  /**
   * Converte um título em um slug legível para nome de branch git.
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }
}
