import assert from "node:assert/strict";
import { GitHubService, type GitHubIssueItem } from "../src/core/github-service.js";
import { createGitHubTools } from "../src/tools/github-tools.js";
import { SelfAuditor } from "../src/core/self-auditor.js";

async function runGitHubTests() {
  console.log("🧪 Iniciando testes do módulo de integração com GitHub...\n");

  // ==========================================
  // 1. Testando Formatação e Payload de Issues
  // ==========================================
  console.log("1. Testando prepareIssuePayload (labels e rodapé)...");
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
    payload1.body.includes("Issue gerada e registrada pelo Benito"),
    "Deve conter o rodapé assinado do Benito"
  );

  // Não duplica rodapé se já presente
  const payload2 = service.prepareIssuePayload({
    title: "fix: bug",
    body: "Corpo com > 🤖 *Issue gerada e registrada pelo Benito* já incluso.",
  });
  const occurrences = (
    payload2.body.match(/Issue gerada e registrada pelo Benito/g) || []
  ).length;
  assert.strictEqual(occurrences, 1, "Não deve duplicar o rodapé");
  console.log("✔ prepareIssuePayload validado com sucesso!");

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
  }

  const mockService = new MockGitHubService();

  // ==========================================
  // 3. Testando Ferramentas do AI SDK
  // ==========================================
  console.log("\n3. Testando ferramentas create_github_issue e list_github_issues...");
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
  } catch (err: any) {
    console.log(`⚠️ Teste opcional de rede ignorado: ${err.message}`);
  }

  console.log("\n🎉 Todos os testes de integração do GitHub passaram com 100% de sucesso!");
}

runGitHubTests().catch((err) => {
  console.error("✖ Falha nos testes do GitHub:", err);
  process.exit(1);
});
