import assert from "node:assert/strict";
import {
  GitHubService,
  type GitHubIssueItem,
  analyzeArchitecturalImpact,
  summarizeDiffIntelligently,
  buildPullRequestExecutiveSummary,
} from "../src/core/github-service.js";
import { createGitHubTools } from "../src/tools/github-tools.js";
import { SelfAuditor } from "../src/core/self-auditor.js";

async function runGitHubTests() {
  console.log("🧪 Iniciando testes do módulo de integração com GitHub...\n");

  // ==========================================
  // 1. Testando Formatação e Payload de Issues e PRs
  // ==========================================
  console.log("1. Testando prepareIssuePayload e preparePullRequestPayload (labels e rodapé sem emojis)...");
  const service = new GitHubService();

  const payload1 = service.prepareIssuePayload({
    title: "feat(tools): nova ferramenta",
    body: "## Contexto\nNecessidade de integração.",
    labels: ["enhancement"],
  });

  assert.strictEqual(payload1.title, "feat(tools): nova ferramenta");
  assert.ok(payload1.labels.includes("benito-sugestao"), "Deve conter label 'benito-sugestao'");
  assert.ok(payload1.labels.includes("enhancement"), "Deve preservar 'enhancement'");
  assert.ok(
    payload1.body.includes("Issue criada e registrada por Benito"),
    "Deve conter o rodapé assinado do Benito"
  );
  assert.ok(
    !payload1.body.includes("🤖"),
    "Rodapé não deve conter emoji robótico"
  );

  // Não duplica rodapé se já presente
  const payload2 = service.prepareIssuePayload({
    title: "fix: bug",
    body: "Corpo com > *Issue criada e registrada por Benito.* já incluso.",
  });
  const occurrences = (
    payload2.body.match(/Issue criada e registrada por Benito/g) || []
  ).length;
  assert.strictEqual(occurrences, 1, "Não deve duplicar o rodapé");

  // Testando preparePullRequestPayload
  const payloadPR = service.preparePullRequestPayload({
    title: "feat(orchestration): suporte a PRs",
    body: "Descrição detalhada do PR.",
    headBranch: "feat/pr-support",
    labels: ["enhancement"],
  });

  assert.strictEqual(payloadPR.title, "feat(orchestration): suporte a PRs");
  assert.ok(payloadPR.labels.includes("benito-pr"), "Deve conter label 'benito-pr'");
  assert.ok(payloadPR.labels.includes("enhancement"), "Deve preservar 'enhancement'");
  assert.strictEqual(payloadPR.headBranch, "feat/pr-support");
  assert.strictEqual(payloadPR.baseBranch, "main");
  assert.ok(
    payloadPR.body.includes("Pull Request criado por Benito"),
    "Deve conter o rodapé assinado de PR do Benito"
  );
  assert.ok(
    !payloadPR.body.includes("🤖"),
    "Rodapé do PR não deve conter emoji robótico"
  );

  // Não duplica rodapé de PR
  const payloadPR2 = service.preparePullRequestPayload({
    title: "fix: ajuste",
    body: "Corpo com > *Pull Request criado por Benito.* já incluso.",
  });
  const occurrencesPR = (
    payloadPR2.body.match(/Pull Request criado por Benito/g) || []
  ).length;
  assert.strictEqual(occurrencesPR, 1, "Não deve duplicar o rodapé do PR");
  console.log("✔ prepareIssuePayload e preparePullRequestPayload validados com sucesso!");

  // ==========================================
  // 1.1 Testando Análise de Impacto Arquitetural e Riscos
  // ==========================================
  console.log("\n1.1 Testando analyzeArchitecturalImpact, summarizeDiffIntelligently e buildPullRequestExecutiveSummary...");

  // Cenário A: Risco Baixo (código com testes, sem quebra, sem SQL, sem .env)
  const lowImpact = analyzeArchitecturalImpact({
    title: "feat(core): adicionar utilitário puro",
    body: "Adiciona helper utilitário de texto.",
    additions: 40,
    deletions: 5,
    files: [
      { path: "src/core/text-utils.ts", additions: 30, deletions: 0 },
      { path: "tests/test-text-utils.ts", additions: 10, deletions: 5 },
    ],
  });
  assert.strictEqual(lowImpact.riskLevel, "BAIXO");
  assert.strictEqual(lowImpact.hasSqlMigrations, false);
  assert.strictEqual(lowImpact.hasDependencyChanges, false);
  assert.strictEqual(lowImpact.hasEnvChanges, false);
  assert.strictEqual(lowImpact.hasBreakingChanges, false);
  assert.strictEqual(lowImpact.hasTestsIncluded, true);

  // Cenário B: Risco Crítico (Breaking Change por título ou commit)
  const breakingImpact = analyzeArchitecturalImpact({
    title: "feat!: reformular interface pública de agentes",
    body: "BREAKING CHANGE: assinaturas modificadas.",
    files: [{ path: "src/core/agent.ts", additions: 50, deletions: 50 }],
  });
  assert.strictEqual(breakingImpact.riskLevel, "CRÍTICO");
  assert.strictEqual(breakingImpact.hasBreakingChanges, true);

  // Cenário C: Risco Crítico (SQL Destrutivo com DROP TABLE)
  const dropSqlImpact = analyzeArchitecturalImpact(
    {
      title: "refactor(db): migração de esquema",
      files: [{ path: "supabase/migrations/20261014_drop.sql", additions: 10, deletions: 0 }],
    },
    "+ DROP TABLE IF EXISTS legacy_users CASCADE;"
  );
  assert.strictEqual(dropSqlImpact.riskLevel, "CRÍTICO");
  assert.strictEqual(dropSqlImpact.hasSqlMigrations, true);
  assert.strictEqual(dropSqlImpact.sqlDestructive, true);

  // Cenário C2: Risco Crítico (SQL Destrutivo com TRUNCATE sem TABLE)
  const truncateSqlImpact = analyzeArchitecturalImpact(
    {
      title: "refactor(db): limpeza de logs legados",
      files: [{ path: "supabase/migrations/20261014_truncate.sql", additions: 5, deletions: 0 }],
    },
    "+ TRUNCATE legacy_logs CASCADE;"
  );
  assert.strictEqual(truncateSqlImpact.riskLevel, "CRÍTICO");
  assert.strictEqual(truncateSqlImpact.sqlDestructive, true);

  // Cenário D: Risco Alto (Migração SQL não-destrutiva)
  const normalSqlImpact = analyzeArchitecturalImpact(
    {
      title: "feat(db): nova tabela de histórico",
      files: [{ path: "supabase/migrations/20261014_create.sql", additions: 25, deletions: 0 }],
    },
    "+ CREATE TABLE history_logs (id UUID PRIMARY KEY);"
  );
  assert.strictEqual(normalSqlImpact.riskLevel, "ALTO");
  assert.strictEqual(normalSqlImpact.hasSqlMigrations, true);
  assert.strictEqual(normalSqlImpact.sqlDestructive, false);

  // Cenário E: Risco Médio (Dependências em package.json e Variáveis em .env)
  const envDepImpact = analyzeArchitecturalImpact(
    {
      title: "chore: atualizar dependencias e template de env",
      files: [
        { path: "package.json", additions: 3, deletions: 0 },
        { path: ".env.example", additions: 1, deletions: 0 },
      ],
    },
    'diff --git a/package.json b/package.json\n+   "@ai-sdk/openai": "^1.0.0",\n+   "new-dep": "^2.1.0",\n+   "version": "1.2.0",\ndiff --git a/package-lock.json b/package-lock.json\n+   "resolved": "https://registry.npmjs.org/zod",\ndiff --git a/.env.example b/.env.example\n+ NEW_SERVICE_TOKEN=xyz'
  );
  assert.strictEqual(envDepImpact.riskLevel, "MÉDIO");
  assert.strictEqual(envDepImpact.hasDependencyChanges, true);
  assert.strictEqual(envDepImpact.hasEnvChanges, true);
  assert.ok(envDepImpact.dependencyDetails?.some((d) => d.includes("new-dep")));
  assert.ok(
    envDepImpact.dependencyDetails?.some((d) => d.includes("@ai-sdk/openai")),
    "Deve capturar pacotes com escopo (@)"
  );
  assert.ok(
    !envDepImpact.dependencyDetails?.some((d) => d.includes("version")),
    "Não deve capturar metadados do package.json"
  );
  assert.ok(
    !envDepImpact.dependencyDetails?.some((d) => d.includes("resolved")),
    "Não deve capturar linhas do package-lock.json"
  );

  // Cenário F: Risco Médio (Código sem arquivos de teste)
  const noTestImpact = analyzeArchitecturalImpact({
    title: "feat(tools): adicionar nova rotina sem testes",
    additions: 120,
    deletions: 10,
    files: [{ path: "src/tools/untested-routine.ts", additions: 120, deletions: 10 }],
  });
  assert.strictEqual(noTestImpact.riskLevel, "MÉDIO");
  assert.strictEqual(noTestImpact.hasTestsIncluded, false);

  // Cenário G: summarizeDiffIntelligently (diff pequeno e diff grande com priorização)
  const smallDiff = "diff --git a/test.ts b/test.ts\n+ console.log('ok');";
  assert.strictEqual(summarizeDiffIntelligently(smallDiff), smallDiff);

  const largeDiff = [
    "diff --git a/supabase/migrations/01_init.sql b/supabase/migrations/01_init.sql\n+ CREATE TABLE users (id int);\n",
    "diff --git a/package.json b/package.json\n+ \"zod\": \"^3.24.0\"\n",
    "diff --git a/src/huge-file.ts b/src/huge-file.ts\n" + "+ linha repetida\n".repeat(600),
  ].join("\n");
  const condensedDiff = summarizeDiffIntelligently(largeDiff, 1000);
  assert.ok(condensedDiff.length <= 1100, "Diff condensado deve respeitar o orçamento de caracteres");
  assert.ok(condensedDiff.includes("migrations/01_init.sql"), "Deve priorizar arquivo SQL crítico");
  assert.ok(condensedDiff.includes("package.json"), "Deve priorizar package.json");

  // Cenário H: buildPullRequestExecutiveSummary (estrutura completa de seções, issue vinculada e release note limpa)
  const execSummary = buildPullRequestExecutiveSummary(
    {
      number: 16,
      title: "feat(github): resumo executivo de PRs",
      body: "## 📦 O que foi implementado\n\n### 1. Resumo Executivo de PRs\n- Detecção de migrações SQL e breaking changes.",
      headRefName: "feat/github-pr-digest-issue-16",
      state: "OPEN",
      author: "ri-favaro",
      url: "https://github.com/ri-favaro/BenitoAgentePessoal/pull/16",
      additions: 150,
      deletions: 20,
      changedFiles: 3,
      files: [
        { path: "src/core/github-service.ts", additions: 100, deletions: 10 },
        { path: "src/tools/github-tools.ts", additions: 40, deletions: 5 },
        { path: "tests/test-github.ts", additions: 10, deletions: 5 },
      ],
    },
    lowImpact,
    "diff --git a/src/test.ts b/src/test.ts\n+ console.log('ok');"
  );
  assert.ok(execSummary.includes("## 📋 Resumo Executivo: PR #16"));
  assert.ok(execSummary.includes("### 🎯 Propósito & Motivação"));
  assert.ok(
    execSummary.includes("- **Issue Vinculada**: #16"),
    "Deve detectar issue vinculada a partir da branch"
  );
  assert.ok(execSummary.includes("### 🔄 Principais Mudanças"));
  assert.ok(execSummary.includes("### 📁 Arquivos Críticos & Áreas Afetadas"));
  assert.ok(execSummary.includes("### ⚠️ Avaliação de Impacto Arquitetural & Riscos"));
  assert.ok(execSummary.includes("### 📝 Notas de Release Sugeridas"));
  assert.ok(
    !execSummary.includes("## 📦 O que foi implementado"),
    "Nota de release não deve conter títulos markdown crus"
  );
  assert.ok(
    execSummary.includes("### 🔍 Amostra do Diff Crítico"),
    "Deve incluir amostra do diff quando fornecido"
  );
  assert.ok(execSummary.includes("Banco de Dados & Migrações"));
  assert.ok(execSummary.includes("Dependências de Terceiros"));
  assert.ok(execSummary.includes("Variáveis de Ambiente & Config"));
  console.log("✔ analyzeArchitecturalImpact, summarizeDiffIntelligently e buildPullRequestExecutiveSummary validados com sucesso!");

  // ==========================================
  // 2. Testando listIssues com Mock / Simulação de Comportamento
  // ==========================================
  console.log("\n2. Testando classe GitHubService e simulação de resposta...");
  class MockGitHubService extends GitHubService {
    async createIssue(options: any) {
      if (options.title.includes("erro")) {
        return { success: false, error: "Erro simulado do gh CLI" };
      }
      return {
        success: true,
        url: "https://github.com/ri-favaro/BenitoAgentePessoal/issues/99",
        issueNumber: 99,
      };
    }

    async listIssues(options: any) {
      if (options.state === "closed") {
        return {
          success: true,
          issues: [],
          totalFound: 0,
        };
      }
      const mockItems: GitHubIssueItem[] = [
        {
          number: 7,
          title: "feat(tools): adicionar ferramenta do GitHub",
          state: "OPEN",
          labels: ["enhancement", "benito-sugestao"],
          url: "https://github.com/ri-favaro/BenitoAgentePessoal/issues/7",
        },
      ];
      return {
        success: true,
        issues: mockItems,
        totalFound: mockItems.length,
      };
    }

    async getIssue(num: number) {
      if (num === 404) {
        return { success: false, error: "Issue #404 não encontrada." };
      }
      return {
        success: true,
        issue: {
          number: num,
          title: "feat(tools): issue individual",
          body: "Corpo detalhado da issue.",
          state: "OPEN",
          labels: ["enhancement"],
          url: `https://github.com/ri-favaro/BenitoAgentePessoal/issues/${num}`,
        },
      };
    }

    async createPullRequest(options: any) {
      if (options.title.includes("erro")) {
        return { success: false, error: "Erro simulado do gh pr create" };
      }
      return {
        success: true,
        url: "https://github.com/ri-favaro/BenitoAgentePessoal/pull/101",
        prNumber: 101,
      };
    }

    async listPullRequests(options: any) {
      return {
        success: true,
        pullRequests: [
          {
            number: 30,
            title: "feat(orchestration): terminal runner",
            body: "Descrição do PR",
            state: "MERGED",
            author: "ri-favaro",
            url: "https://github.com/ri-favaro/BenitoAgentePessoal/pull/30",
            additions: 100,
            deletions: 20,
            changedFiles: 5,
          },
        ],
        totalFound: 1,
      };
    }

    async getPullRequest(prNumber: number, options: any) {
      if (prNumber === 404) {
        return { success: false, error: "PR não encontrado." };
      }
      return {
        success: true,
        pullRequest: {
          number: prNumber,
          title: "feat(orchestration): terminal runner",
          body: "Corpo do PR",
          state: "MERGED",
          author: "ri-favaro",
          url: `https://github.com/ri-favaro/BenitoAgentePessoal/pull/${prNumber}`,
        },
        diff: "diff --git a/file.ts b/file.ts",
      };
    }

    async listCommits(options: any) {
      return {
        success: true,
        commits: [
          {
            hash: "abcdef123456",
            shortHash: "abcdef1",
            authorName: "Luiz Ricardo",
            date: "2026-10-14",
            message: "feat: commit de teste",
          },
        ],
        totalFound: 1,
      };
    }

    async summarizeMergedPullRequests(options: any) {
      return {
        success: true,
        totalMerged: 1,
        summary: "## 📊 Resumo de Entregas: 1 PR(s) Mergeado(s)",
        pullRequests: [],
      };
    }

    async summarizePullRequest(prNumber: number, options: any) {
      if (prNumber === 404) {
        return { success: false, error: "Pull Request #404 não encontrado." };
      }
      return {
        success: true,
        prNumber,
        title: "feat(orchestration): terminal runner",
        url: `https://github.com/ri-favaro/BenitoAgentePessoal/pull/${prNumber}`,
        state: "MERGED",
        author: "ri-favaro",
        stats: { additions: 100, deletions: 20, changedFiles: 5 },
        architecturalImpact: {
          riskLevel: "BAIXO",
          hasSqlMigrations: false,
          sqlFiles: [],
          hasDependencyChanges: false,
          dependencyFiles: [],
          hasEnvChanges: false,
          envFiles: [],
          hasBreakingChanges: false,
          breakingChangeReasons: [],
          hasTestsIncluded: true,
          testFiles: ["tests/test-orchestration.ts"],
          riskReasons: ["Alterações com baixo risco arquitetural."],
        },
        summary: `## 📋 Resumo Executivo: PR #${prNumber} - feat(orchestration): terminal runner\n\n### 🎯 Propósito & Motivação\nImplementação do runner.\n\n### 🔄 Principais Mudanças\n- Commit inicial\n\n### 📁 Arquivos Críticos & Áreas Afetadas\n- src/terminal.ts\n\n### ⚠️ Avaliação de Impacto Arquitetural & Riscos\n- **Nível de Risco Consolidado**: 🟢 **BAIXO**\n- 🗄️ **Banco de Dados & Migrações**: Nenhuma migração SQL identificada.\n- 📦 **Dependências de Terceiros**: Nenhuma alteração em dependências externas.\n- 🔐 **Variáveis de Ambiente & Config**: Nenhuma alteração em arquivos de ambiente (.env).\n- 💥 **Quebras de Compatibilidade (Breaking Changes)**: Nenhuma quebra identificada.\n- 🧪 **Cobertura de Testes**: Testes inclusos/atualizados.`,
        diffSummary: options.includeDiff ? "diff --git a/file.ts b/file.ts\n+ codigo" : undefined,
      };
    }
  }

  // 2.1 Testando fallback resiliente para erro de labels inexistentes em createIssue e createPullRequest
  console.log("\n2.1 Testando resiliência a labels inexistentes (fallback sem --label)...");
  class FallbackTestGitHubService extends GitHubService {
    public calls: string[][] = [];

    protected override async execGh(args: string[]): Promise<{ stdout: string }> {
      this.calls.push(args);
      // Se tiver flag --label, simula erro do GitHub de label inexistente
      if (args.includes("--label")) {
        throw new Error("could not add label: 'benito-pr' not found");
      }
      // Se não tiver --label (segunda chamada / fallback), retorna sucesso
      if (args[0] === "issue") {
        return { stdout: "https://github.com/ri-favaro/BenitoAgentePessoal/issues/105\n" };
      }
      return { stdout: "https://github.com/ri-favaro/BenitoAgentePessoal/pull/105\n" };
    }
  }

  const fallbackService = new FallbackTestGitHubService();

  // Teste em createIssue
  const issueFallbackRes = await fallbackService.createIssue({
    title: "feat: nova funcionalidade com label",
    body: "Corpo da issue",
    labels: ["label-inexistente"],
  });
  assert.strictEqual(issueFallbackRes.success, true);
  assert.strictEqual(issueFallbackRes.issueNumber, 105);
  assert.strictEqual(fallbackService.calls.length, 2, "Deve tentar com label e depois fallback sem label");
  assert.ok(fallbackService.calls[0].includes("--label"), "Primeira chamada deve conter --label");
  assert.ok(!fallbackService.calls[1].includes("--label"), "Segunda chamada não deve conter --label");

  // Limpa chamadas e testa em createPullRequest
  fallbackService.calls = [];
  const prFallbackRes = await fallbackService.createPullRequest({
    title: "feat: novo PR com label",
    body: "Corpo do PR",
    labels: ["label-inexistente"],
  });
  assert.strictEqual(prFallbackRes.success, true);
  assert.strictEqual(prFallbackRes.prNumber, 105);
  assert.strictEqual(fallbackService.calls.length, 2, "Deve tentar com label e depois fallback sem label");
  assert.ok(fallbackService.calls[0].includes("--label"), "Primeira chamada de PR deve conter --label");
  assert.ok(!fallbackService.calls[1].includes("--label"), "Segunda chamada de PR não deve conter --label");
  console.log("✔ Fallback resiliente sem labels validado com sucesso para issues e PRs!");

  const mockService = new MockGitHubService();

  // ==========================================
  // 3. Testando Ferramentas do AI SDK
  // ==========================================
  console.log("\n3. Testando ferramentas create_github_issue, list_github_issues, get_github_issue, create_github_pr, list_github_prs, get_github_pr, list_recent_commits, summarize_merged_prs e summarize_github_pr...");
  const tools = createGitHubTools(mockService as any);

  // 3.1 create_github_issue - Sucesso
  const createRes: any = await tools.create_github_issue.execute({
    title: "feat(test): teste de ferramenta",
    body: "Conteúdo do teste",
    labels: ["enhancement"],
  });
  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.issueNumber, 99);
  assert.ok(createRes.url.includes("/issues/99"));
  console.log("✔ create_github_issue executou com sucesso!");

  // 3.2 create_github_issue - Falha controlada
  const createFailRes: any = await tools.create_github_issue.execute({
    title: "erro: falhar",
    body: "Corpo com falha",
  });
  assert.strictEqual(createFailRes.success, false);
  assert.ok(createFailRes.error.includes("Erro simulado"));
  console.log("✔ create_github_issue tratou erro graciosamente!");

  // 3.3 list_github_issues - Sucesso
  const listRes: any = await tools.list_github_issues.execute({
    state: "open",
    limit: 5,
  });
  assert.strictEqual(listRes.success, true);
  assert.strictEqual(listRes.totalFound, 1);
  assert.ok(listRes.summary.includes("#7 [OPEN]"));
  console.log("✔ list_github_issues executou e gerou resumo com sucesso!");

  // 3.4 list_github_issues - Lista vazia
  const listEmptyRes: any = await tools.list_github_issues.execute({
    state: "closed",
  });
  assert.strictEqual(listEmptyRes.success, true);
  assert.strictEqual(listEmptyRes.totalFound, 0);
  assert.ok(listEmptyRes.summary.includes("Nenhuma issue encontrada"));
  console.log("✔ list_github_issues com zero resultados validado!");

  // 3.5 get_github_issue - Sucesso
  const getIssueRes: any = await tools.get_github_issue.execute({
    issueNumber: 21,
  });
  assert.strictEqual(getIssueRes.success, true);
  assert.strictEqual(getIssueRes.issue.number, 21);
  assert.ok(getIssueRes.summary.includes("#21 [OPEN]"));
  console.log("✔ get_github_issue executou e retornou detalhes com sucesso!");

  // 3.6 get_github_issue - Não encontrada
  const getIssueFailRes: any = await tools.get_github_issue.execute({
    issueNumber: 404,
  });
  assert.strictEqual(getIssueFailRes.success, false);
  console.log("✔ get_github_issue tratou issue inexistente com sucesso!");

  // 3.7 create_github_pr - Sucesso
  const prRes: any = await tools.create_github_pr.execute({
    title: "feat(tools): suporte a PR",
    body: "Corpo do PR de teste",
    headBranch: "feat/pr-support",
  });
  assert.strictEqual(prRes.success, true);
  assert.strictEqual(prRes.prNumber, 101);
  assert.ok(prRes.url.includes("/pull/101"));
  console.log("✔ create_github_pr executou com sucesso!");

  // 3.8 create_github_pr - Falha controlada
  const prFailRes: any = await tools.create_github_pr.execute({
    title: "erro: falha no pr",
    body: "Corpo com falha",
  });
  assert.strictEqual(prFailRes.success, false);
  assert.ok(prFailRes.error.includes("Erro simulado"));
  console.log("✔ create_github_pr tratou erro graciosamente!");

  // 3.9 list_github_prs - Sucesso
  const listPrsRes: any = await tools.list_github_prs.execute({
    state: "merged",
    limit: 5,
  });
  assert.strictEqual(listPrsRes.success, true);
  assert.strictEqual(listPrsRes.totalFound, 1);
  assert.ok(listPrsRes.summary.includes("#30 [MERGED]"));
  console.log("✔ list_github_prs executou com sucesso!");

  // 3.10 get_github_pr - Sucesso
  const getPrRes: any = await tools.get_github_pr.execute({
    prNumber: 30,
    includeDiff: true,
  });
  assert.strictEqual(getPrRes.success, true);
  assert.strictEqual(getPrRes.pullRequest.number, 30);
  assert.ok(getPrRes.diff.includes("diff --git"));
  console.log("✔ get_github_pr executou com sucesso!");

  // 3.11 list_recent_commits - Sucesso
  const commitsRes: any = await tools.list_recent_commits.execute({
    limit: 5,
  });
  assert.strictEqual(commitsRes.success, true);
  assert.strictEqual(commitsRes.totalFound, 1);
  assert.ok(commitsRes.summary.includes("[abcdef1]"));
  console.log("✔ list_recent_commits executou com sucesso!");

  // 3.12 summarize_merged_prs - Sucesso
  const summaryRes: any = await tools.summarize_merged_prs.execute({
    limit: 5,
  });
  assert.strictEqual(summaryRes.success, true);
  assert.strictEqual(summaryRes.totalMerged, 1);
  assert.ok(summaryRes.summary.includes("Resumo de Entregas"));
  console.log("✔ summarize_merged_prs executou com sucesso!");

  // 3.13 summarize_github_pr - Sucesso
  const prSummaryRes: any = await tools.summarize_github_pr.execute({
    prNumber: 30,
    includeDiff: true,
  });
  assert.strictEqual(prSummaryRes.success, true);
  assert.strictEqual(prSummaryRes.prNumber, 30);
  assert.strictEqual(prSummaryRes.riskLevel, "BAIXO");
  assert.ok(prSummaryRes.summary.includes("Resumo Executivo"));
  assert.ok(prSummaryRes.architecturalImpact !== undefined);
  assert.ok(prSummaryRes.diffSummary?.includes("diff --git"));
  console.log("✔ summarize_github_pr executou com sucesso!");

  // 3.14 summarize_github_pr - Falha controlada (404)
  const prSummaryFailRes: any = await tools.summarize_github_pr.execute({
    prNumber: 404,
  });
  assert.strictEqual(prSummaryFailRes.success, false);
  assert.ok(prSummaryFailRes.error.includes("não encontrado"));
  console.log("✔ summarize_github_pr tratou erro graciosamente!");

  // ==========================================
  // 4. Testando Integração com SelfAuditor
  // ==========================================
  console.log("\n4. Testando SelfAuditor com GitHubService unificado...");
  const auditor = new SelfAuditor();
  const auditorMethod = typeof auditor.createGitHubIssue;
  assert.strictEqual(auditorMethod, "function", "SelfAuditor deve possuir createGitHubIssue");
  console.log("✔ SelfAuditor integração validada!");

  // ==========================================
  // 5. Testando Conectividade Real com CLI `gh`
  // ==========================================
  console.log("\n5. Testando execução real do gh CLI (listIssues limit: 2)...");
  try {
    const realResult = await service.listIssues({ state: "open", limit: 2 });
    if (realResult.success) {
      console.log(`✔ Conexão real com gh CLI estabelecida! Encontradas ${realResult.totalFound} issues.`);
      if (realResult.issues && realResult.issues.length > 0) {
        console.log(`  Exemplo de issue real: #${realResult.issues[0].number} - ${realResult.issues[0].title}`);
      }
    } else {
      console.log(`⚠️ gh CLI retornou aviso (esperado se não houver internet/token): ${realResult.error}`);
    }

    // Teste real de summarizePullRequest (PR 33 que já existe e está mergeado)
    const realPrSummary = await service.summarizePullRequest(33, { includeDiff: true });
    if (realPrSummary.success) {
      console.log(`✔ summarizePullRequest real executado com sucesso para PR #33!`);
      assert.strictEqual(realPrSummary.prNumber, 33);
      assert.ok(realPrSummary.summary?.includes("Resumo Executivo"));
      assert.ok(realPrSummary.architecturalImpact !== undefined);
      assert.strictEqual(realPrSummary.architecturalImpact?.hasBreakingChanges, false);
    }
  } catch (err: any) {
    console.log(`⚠️ Teste opcional de rede ignorado: ${err.message}`);
  }

  console.log("\n🎉 Todos os testes de integração do GitHub passaram com 100% de sucesso!");
}

runGitHubTests().catch((err) => {
  console.error("✖ Falha nos testes do GitHub:", err);
  process.exit(1);
});
