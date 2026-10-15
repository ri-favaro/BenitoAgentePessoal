import path from "node:path";
import pc from "picocolors";
import { TerminalRunner } from "../src/orchestration/terminal-runner.js";
import { TaskPacker } from "../src/orchestration/task-packer.js";
import { CodingOrchestrator } from "../src/orchestration/coding-orchestrator.js";
import { createOrchestrationTools } from "../src/tools/orchestration-tools.js";
import { GitHubService, type GitHubIssueDetail } from "../src/core/github-service.js";

async function runOrchestrationTests() {
  console.log(pc.cyan("\n=== TESTES DO SISTEMA DE ORQUESTRAÇÃO & CODING RUNNER (ISSUE #21) ===\n"));

  const projectRoot = process.cwd();
  const allowedPaths = [projectRoot];

  // ==========================================
  // 1. TESTES DO TERMINAL RUNNER
  // ==========================================
  console.log(pc.yellow("1. Testando TerminalRunner (Sandbox & Whitelist)..."));

  const runner = new TerminalRunner({
    projectRoot,
    allowedPaths,
    allowedCommands: ["agy", "npm", "npx", "git", "node"],
    timeoutMs: 5000,
  });

  // 1.1 Bloqueio de diretório fora da sandbox
  const forbiddenDir = path.resolve("C:\\Windows\\System32");
  const sandboxBlockRes = await runner.execute({
    command: "node",
    args: ["-v"],
    cwd: forbiddenDir,
  });

  if (!sandboxBlockRes.success && sandboxBlockRes.error?.includes("Acesso negado")) {
    console.log(pc.green("✔ Sandbox bloqueou execução fora dos diretórios autorizados!"));
  } else {
    console.error(pc.red("✖ Falha na trava de sandbox do TerminalRunner:"), sandboxBlockRes);
    process.exit(1);
  }

  // 1.2 Bloqueio de comando fora da whitelist
  const forbiddenCmdRes = await runner.execute({
    command: "curl",
    args: ["https://example.com"],
  });

  if (!forbiddenCmdRes.success && forbiddenCmdRes.error?.includes("não permitido pela política de segurança")) {
    console.log(pc.green("✔ Whitelist bloqueou comando não autorizado (curl)!"));
  } else {
    console.error(pc.red("✖ Falha na whitelist do TerminalRunner:"), forbiddenCmdRes);
    process.exit(1);
  }

  // 1.3 Execução com sucesso de comando permitido
  const validExecRes = await runner.execute({
    command: "node",
    args: ["-e", "console.log('ORCHESTRATION_RUNNER_OK')"],
  });

  if (validExecRes.success && validExecRes.stdout.includes("ORCHESTRATION_RUNNER_OK")) {
    console.log(pc.green(`✔ Comando permitido executou com sucesso em ${validExecRes.durationMs}ms!`));
  } else {
    console.error(pc.red("✖ Falha na execução de comando permitido:"), validExecRes);
    process.exit(1);
  }

  // 1.4 Teste de timeout do runner
  const timeoutRunner = new TerminalRunner({
    projectRoot,
    allowedPaths,
    allowedCommands: ["node"],
    timeoutMs: 150, // Timeout muito curto de 150ms
  });

  const timeoutRes = await timeoutRunner.execute({
    command: "node",
    args: ["-e", "setTimeout(() => console.log('concluido'), 1000)"],
  });

  if (!timeoutRes.success && timeoutRes.error?.includes("tempo limite")) {
    console.log(pc.green("✔ Trava de timeout abortou processo longo com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha no controle de timeout do TerminalRunner:"), timeoutRes);
    process.exit(1);
  }

  // ==========================================
  // 2. TESTES DO TASK PACKER
  // ==========================================
  console.log(pc.yellow("\n2. Testando TaskPacker (Estruturação de Contexto & Regras)..."));

  const taskPacker = new TaskPacker();
  const mockIssue: GitHubIssueDetail = {
    number: 21,
    title: "feat(orchestration): terminal runner para acionar coding LLMs",
    body: "## Objetivo\nImplementar terminal runner seguro para delegar issues ao AGY CLI.\n\n## Critérios de Aceite\n- [ ] Sandbox path-guard\n- [ ] Whitelist",
    state: "open",
    labels: ["enhancement"],
    url: "https://github.com/ri-favaro/BenitoAgentePessoal/issues/21",
  };

  const packed = taskPacker.packTask({
    issue: mockIssue,
    codeSnippets: [
      {
        path: "src/tools/path-guard.ts",
        content: "export function validateAllowedPath(path, dirs) { ... }",
      },
    ],
    additionalInstructions: "Não utilize frameworks externos de IA.",
  });

  if (
    packed.issueNumber === 21 &&
    packed.branchName.startsWith("feat/issue-21") &&
    packed.prompt.includes("TAREFA DE IMPLEMENTAÇÃO: Issue #21") &&
    packed.prompt.includes("DIRETRIZES DE ENGENHARIA") &&
    packed.prompt.includes("src/tools/path-guard.ts") &&
    packed.prompt.includes("Não utilize frameworks externos de IA.") &&
    packed.prompt.includes("Passos Obrigatórios para Conclusão") &&
    packed.prompt.includes("git push -u origin") &&
    packed.contextSnippetsCount === 1
  ) {
    console.log(pc.green("✔ TaskPacker empacotou contexto, regras, código e instruções de git push com alta fidelidade!"));
  } else {
    console.error(pc.red("✖ Falha na montagem de prompt do TaskPacker:"), packed);
    process.exit(1);
  }

  // ==========================================
  // 3. TESTES DO CODING ORCHESTRATOR
  // ==========================================
  console.log(pc.yellow("\n3. Testando CodingOrchestrator (Dry-Run & Validações)..."));

  // Mock do GitHubService para testes previsíveis
  class MockGitHubService extends GitHubService {
    override async getIssue(num: number): Promise<any> {
      return {
        success: true,
        issue: {
          number: num,
          title: "Implementar funcionalidade de teste",
          body: "Descrição detalhada do teste unitário.",
          state: "open",
          labels: ["test"],
          url: `https://github.com/teste/issues/${num}`,
        },
      };
    }
  }

  const orchestrator = new CodingOrchestrator({
    projectRoot,
    terminalRunner: runner,
    taskPacker,
    gitHubService: new MockGitHubService(projectRoot),
  });

  const prepRes = await orchestrator.prepareTask({ issueNumber: 21 });
  if (prepRes.success && prepRes.packedTask?.issueNumber === 21) {
    console.log(pc.green("✔ prepareTask consultou issue e empacotou com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha no prepareTask do orchestrator:"), prepRes);
    process.exit(1);
  }

  // Teste de simulação dry-run
  const dryRunRes = await orchestrator.delegateIssue({
    issueNumber: 21,
    dryRun: true,
  });

  if (
    dryRunRes.success &&
    dryRunRes.terminalResult?.stdout.includes("[DRY-RUN]")
  ) {
    console.log(pc.green("✔ delegateIssue executou simulação em dry-run perfeitamente!"));
  } else {
    console.error(pc.red("✖ Falha na execução dry-run do orchestrator:"), dryRunRes);
    process.exit(1);
  }

  // 3.2 Teste com autoCreatePr: true em dry-run
  const dryRunPrRes = await orchestrator.delegateIssue({
    issueNumber: 21,
    dryRun: true,
    autoCreatePr: true,
  });

  if (
    dryRunPrRes.success &&
    dryRunPrRes.pullRequest?.prNumber === 999 &&
    dryRunPrRes.pullRequest?.url?.includes("[DRY-RUN]")
  ) {
    console.log(pc.green("✔ delegateIssue com autoCreatePr simulou abertura de PR em dry-run!"));
  } else {
    console.error(pc.red("✖ Falha na simulação de PR em delegateIssue:"), dryRunPrRes);
    process.exit(1);
  }

  // ==========================================
  // 4. TESTES DAS FERRAMENTAS (ORCHESTRATION TOOLS)
  // ==========================================
  console.log(pc.yellow("\n4. Testando Ferramentas de Orquestração (createOrchestrationTools)..."));

  const tools = createOrchestrationTools({
    terminalRunner: runner,
    codingOrchestrator: orchestrator,
  });

  // 4.1 execute_workspace_command com git --version
  const toolExecRes: any = await tools.execute_workspace_command.execute({
    command: "git",
    args: ["--version"],
  });

  if (toolExecRes.success && toolExecRes.stdout.includes("git version")) {
    console.log(pc.green("✔ Ferramenta execute_workspace_command executou comando permitido com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha em execute_workspace_command:"), toolExecRes);
    process.exit(1);
  }

  // 4.2 Trava Human-in-the-Loop em delegate_issue_to_coding_agent
  const hitlBlockedRes: any = await tools.delegate_issue_to_coding_agent.execute({
    issueNumber: 21,
    confirmedByUser: false,
    dryRun: false,
  });

  if (!hitlBlockedRes.success && hitlBlockedRes.error?.includes("Human-in-the-Loop")) {
    console.log(pc.green("✔ Trava Human-in-the-Loop bloqueou execução sem consentimento do usuário!"));
  } else {
    console.error(pc.red("✖ Falha na trava Human-in-the-Loop:"), hitlBlockedRes);
    process.exit(1);
  }

  // 4.3 Execução com dryRun: true através da ferramenta
  const toolDryRunRes: any = await tools.delegate_issue_to_coding_agent.execute({
    issueNumber: 21,
    confirmedByUser: false,
    dryRun: true,
  });

  if (toolDryRunRes.success && toolDryRunRes.dryRun === true) {
    console.log(pc.green("✔ Ferramenta delegate_issue_to_coding_agent concluiu dry-run com segurança!"));
  } else {
    console.error(pc.red("✖ Falha no dry-run da ferramenta:"), toolDryRunRes);
    process.exit(1);
  }

  // 4.4 Teste de prepare_coding_task
  const toolPrepRes: any = await tools.prepare_coding_task.execute({
    issueNumber: 21,
    additionalInstructions: "Priorize modularidade e clareza.",
  });

  if (toolPrepRes.success && toolPrepRes.fullPrompt.includes("Priorize modularidade e clareza.")) {
    console.log(pc.green("✔ Ferramenta prepare_coding_task retornou dados estruturados com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha em prepare_coding_task:"), toolPrepRes);
    process.exit(1);
  }

  // 4.5 Execução com dryRun: true e autoCreatePr: true através da ferramenta
  const toolDryRunPrRes: any = await tools.delegate_issue_to_coding_agent.execute({
    issueNumber: 21,
    confirmedByUser: false,
    dryRun: true,
    autoCreatePr: true,
  });

  if (
    toolDryRunPrRes.success &&
    toolDryRunPrRes.pullRequest?.prNumber === 999
  ) {
    console.log(pc.green("✔ Ferramenta delegate_issue_to_coding_agent com autoCreatePr retornou PR com sucesso!"));
  } else {
    console.error(pc.red("✖ Falha em delegate_issue_to_coding_agent com autoCreatePr:"), toolDryRunPrRes);
    process.exit(1);
  }

  console.log(pc.green("\nTodos os 11 testes de Orquestração Técnica & Coding Runner passaram com 100% de sucesso!\n"));
}

runOrchestrationTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste de Orquestração:"), err);
  process.exit(1);
});
