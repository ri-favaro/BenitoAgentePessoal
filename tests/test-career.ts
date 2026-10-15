import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import {
  createCareerTools,
  ensureCareerProfileExists,
  evaluateJobMatch,
  buildConnectionPitch,
  buildTailoredResumeMarkdown,
  loadAnalyzedJobs,
  extractJobMetadata,
  cleanJobPostingContent,
} from "../src/tools/career-tools.js";

async function runCareerTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTES DO COPILOTO DE CARREIRA E ANÁLISE DE VAGAS (ISSUE #26) ===\n")));

  const tempVaultDir = path.resolve(process.cwd(), "tests", "temp-career-vault");
  const allowedDirs = [process.cwd(), tempVaultDir];

  // Limpeza prévia
  await fs.rm(tempVaultDir, { recursive: true, force: true });
  await fs.mkdir(tempVaultDir, { recursive: true });

  const tools = createCareerTools(tempVaultDir, allowedDirs);

  try {
    // ==========================================
    // 1. Testando ensureCareerProfileExists
    // ==========================================
    console.log(pc.yellow("1. Testando inicialização e integridade do perfil-profissional.md..."));
    const init1 = await ensureCareerProfileExists(tempVaultDir, allowedDirs);
    assert.strictEqual(init1.created, true);
    assert.ok(init1.filePath.endsWith("perfil-profissional.md"));

    const content = await fs.readFile(init1.filePath, "utf-8");
    assert.ok(content.includes("# 👨‍💻 Perfil Profissional Master - Luiz Ricardo"));
    assert.ok(content.includes("MBA em Engenharia de Software"));
    assert.ok(content.includes("CONTELE-OS"));
    assert.ok(content.includes("Benito"));
    assert.ok(content.includes("TypeScript"));
    assert.ok(content.includes("Node.js"));

    // Segunda chamada deve ser idempotente (created: false)
    const init2 = await ensureCareerProfileExists(tempVaultDir, allowedDirs);
    assert.strictEqual(init2.created, false);
    console.log(pc.green("✔ Perfil master inicializado e validado com sucesso!"));

    // ==========================================
    // 2. Testando evaluateJobMatch com diferentes perfis de vaga
    // ==========================================
    console.log(pc.yellow("\n2. Testando heurística de aderência calibrada para nível Pleno..."));

    // Cenário A: Vaga ideal Pleno Backend Node.js / TypeScript
    const jobA = `
      Buscamos Desenvolvedor Backend Pleno.
      Requisitos: TypeScript, Node.js, PostgreSQL, Docker, testes unitários e noções de Clean Architecture ou DDD.
      Diferenciais: Mensageria com RabbitMQ ou Kafka, Next.js.
    `;
    const resA = evaluateJobMatch(jobA, "Fintech Alfa", "Desenvolvedor Backend Pleno");
    assert.strictEqual(resA.verdict, "Sim");
    assert.ok(resA.matchScore >= 75);
    assert.ok(resA.strengths.some((s) => s.includes("TypeScript")));
    assert.ok(resA.strengths.some((s) => s.includes("Node.js")));
    assert.ok(resA.quickWins.some((q) => q.includes("Clean Architecture") || q.includes("DDD")));
    assert.strictEqual(resA.criticalGaps.length, 0);

    // Cenário B: Vaga com ressalvas (desvios pontuais de stack)
    const jobB = `
      Engenheiro de Software Pleno.
      Requisitos: Node.js, Python, AWS, Docker e Kubernetes em produção.
      Diferenciais: CI/CD e mensageria.
    `;
    const resB = evaluateJobMatch(jobB, "Tech Beta", "Engenheiro de Software Pleno");
    assert.ok(resB.verdict === "Com ressalvas" || resB.verdict === "Sim");
    assert.ok(resB.matchScore >= 50);

    // Cenário C: Vaga Sênior / Lead fora do escopo
    const jobC = `
      Tech Lead / Especialista Java.
      Requisitos mandatórios: 8+ anos de experiência, gestão de pessoas e ecossistema Java / Spring Boot.
    `;
    const resC = evaluateJobMatch(jobC, "Enterprise Gamma", "Tech Lead Java");
    assert.strictEqual(resC.verdict, "Não");
    assert.ok(resC.criticalGaps.length >= 1);
    assert.ok(resC.matchScore < 50);

    // Cenário D: Vaga de IA Generativa, Agentes e RAG (Estilo Implanta / Benito)
    const jobD = `
      Title: Implanta hiring Desenvolvedor(a) Harness Multiagente in Brazil | LinkedIn

      Procuramos uma pessoa desenvolvedora para apoiar a construção do Harness Multiagente, plataforma com agentes de IA.
      Requisitos obrigatórios:
      - Experiência sólida em Python e criação de APIs (FastAPI ou Flask).
      - Experiência com LLMs em produção e engenharia de prompts.
      - Conhecimento de RAG, embeddings, chunking e bases vetoriais com pgvector no PostgreSQL.
      - Experiência com orquestração de agentes (LangChain, LangGraph, LlamaIndex ou similares).
      - Microsserviços, Docker e testes automatizados.
      - Experiência pleno ou sênior: engenharia de software e projetos com IA generativa.
      Diferenciais:
      - Orquestração multiagente, tool calling e observabilidade.

      ## Similar jobs
      - Desenvolvedor .NET Sênior na Empresa X (C#, .NET 8, 8+ anos)
    `;

    // Validação de corte de rodapé (Similar jobs com .NET)
    const cleanedJobD = cleanJobPostingContent(jobD);
    assert.ok(cleanedJobD.includes("Harness Multiagente"));
    assert.ok(cleanedJobD.includes("LangGraph"));
    assert.strictEqual(cleanedJobD.includes(".NET Sênior"), false); // Footer cortado!

    // Validação de extração de metadados
    const metaD = extractJobMetadata(jobD);
    assert.strictEqual(metaD.company, "Implanta");
    assert.strictEqual(metaD.role, "Desenvolvedor(a) Harness Multiagente");

    // Validação de aderência para IA/Agentes
    const resD = evaluateJobMatch(cleanedJobD, metaD.company, metaD.role);
    assert.ok(resD.verdict === "Sim" || resD.verdict === "Com ressalvas");
    assert.ok(resD.matchScore >= 75);
    assert.ok(resD.strengths.some((s) => s.includes("IA Generativa") || s.includes("Agentes") || s.includes("RAG")));
    assert.strictEqual(resD.criticalGaps.some((g) => g.includes(".NET")), false);
    console.log(pc.green("✔ Calibração de aderência e vereditos (Sim / Ressalvas / Não) e corte de rodapé validados com precisão!"));

    // ==========================================
    // 3. Testando analyze_job_posting (Tool AI SDK & Persistência)
    // ==========================================
    console.log(pc.yellow("\n3. Testando ferramenta analyze_job_posting e persistência incremental..."));

    const analyzeRes1: any = await tools.analyze_job_posting.execute(
      {
        company: "Nubank",
        role: "Engenheiro de Software Backend Pleno",
        jobText: jobA,
      },
      { messages: [], toolCallId: "call-1" }
    );

    assert.strictEqual(analyzeRes1.success, true);
    assert.strictEqual(analyzeRes1.company, "Nubank");
    assert.strictEqual(analyzeRes1.verdict, "Sim");
    assert.ok(analyzeRes1.matchScore >= 75);

    // Verifica se gravou no arquivo JSON
    const storedJobs1 = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    assert.strictEqual(storedJobs1.length, 1);
    assert.strictEqual(storedJobs1[0].company, "Nubank");

    // Re-análise da mesma empresa deve atualizar o registro sem duplicar
    const analyzeRes2: any = await tools.analyze_job_posting.execute(
      {
        company: "Nubank",
        role: "Engenheiro de Software Backend Pleno",
        jobText: jobA + "\nRequisitos adicionais: Docker e SQL.",
      },
      { messages: [], toolCallId: "call-2" }
    );
    assert.strictEqual(analyzeRes2.success, true);

    const storedJobs2 = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    assert.strictEqual(storedJobs2.length, 1); // Idempotência mantida

    // Adiciona uma segunda vaga para compor o histórico
    await tools.analyze_job_posting.execute(
      {
        company: "Mercado Livre",
        role: "Desenvolvedor Pleno",
        jobText: jobB,
      },
      { messages: [], toolCallId: "call-3" }
    );

    // Adiciona uma terceira vaga via auto-extração de metadados (sem passar company e role)
    const analyzeRes4: any = await tools.analyze_job_posting.execute(
      {
        jobText: jobD,
      },
      { messages: [], toolCallId: "call-4" }
    );
    assert.strictEqual(analyzeRes4.success, true);
    assert.strictEqual(analyzeRes4.company, "Implanta");
    assert.strictEqual(analyzeRes4.role, "Desenvolvedor(a) Harness Multiagente");
    assert.ok(analyzeRes4.matchScore >= 75);

    const storedJobs3 = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    assert.strictEqual(storedJobs3.length, 3);
    console.log(pc.green("✔ analyze_job_posting, auto-extração e persistência estruturada em vagas-analisadas.json validados!"));

    // ==========================================
    // 4. Testando generate_tailored_application (CV & Pitch)
    // ==========================================
    console.log(pc.yellow("\n4. Testando generate_tailored_application (CV Markdown e Pitch no topo)..."));

    const appRes: any = await tools.generate_tailored_application.execute(
      {
        company: "Nubank",
        role: "Engenheiro de Software Backend Pleno",
        focusSkills: ["TypeScript", "Node.js", "Clean Architecture", "PostgreSQL"],
      },
      { messages: [], toolCallId: "call-4" }
    );

    assert.strictEqual(appRes.success, true);
    assert.ok(appRes.filePath.includes("Carreira"));
    assert.ok(appRes.filePath.includes("Vagas"));
    assert.ok(appRes.pitch.includes("Nubank"));
    assert.ok(appRes.pitch.includes("USP/Esalq"));

    // Valida o arquivo real salvo no disco
    const cvFileContent = await fs.readFile(appRes.filePath, "utf-8");
    assert.ok(cvFileContent.includes("## 🎯 Pitch de Conexão (LinkedIn / Recrutador)"));
    assert.ok(cvFileContent.includes("## 📄 Currículo Personalizado"));
    assert.ok(cvFileContent.includes("CONTELE-OS"));
    assert.ok(cvFileContent.includes("Benito"));

    // Verifica se vinculou cvPath no registro JSON da vaga
    const updatedJobs = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    const nubankJob = updatedJobs.find((j) => j.company === "Nubank");
    assert.ok(nubankJob?.cvPath);
    console.log(pc.green("✔ CV adaptado e Pitch de Conexão gerados e persistidos com sucesso!"));

    // ==========================================
    // 5. Testando generate_career_report (Observatório de Mercado)
    // ==========================================
    console.log(pc.yellow("\n5. Testando generate_career_report e matriz de estudos..."));

    const reportRes: any = await tools.generate_career_report.execute(
      { updateVaultNote: true },
      { messages: [], toolCallId: "call-5" }
    );

    assert.strictEqual(reportRes.success, true);
    assert.strictEqual(reportRes.totalJobsAnalyzed, 3);
    assert.ok(reportRes.averageMatchScore > 0);
    assert.ok(reportRes.topSkills.length > 0);
    assert.ok(reportRes.studyMatrix.length > 0);
    assert.ok(reportRes.reportMarkdown.includes("Observatório de Mercado"));

    // Valida nota criada no cofre
    const reportFilePath = path.join(tempVaultDir, "Carreira", "relatorio-gaps-mercado.md");
    const noteContent = await fs.readFile(reportFilePath, "utf-8");
    assert.ok(noteContent.includes("Matriz de Estudos Priorizados"));
    assert.ok(noteContent.includes("Nubank") === false); // dados agregados
    assert.ok(noteContent.includes("**Total de Vagas Analisadas:** 3"));
    console.log(pc.green("✔ generate_career_report consolidou mercado e gerou nota executiva perfeitamente!"));

    // ==========================================
    // 6. Testando Proteção de Sandbox (path-guard)
    // ==========================================
    console.log(pc.yellow("\n6. Testando proteção estrita de sandbox com path-guard..."));

    const evilTools = createCareerTools("C:\\Windows\\System32", allowedDirs);
    const sandboxedApp: any = await evilTools.generate_tailored_application.execute(
      { company: "EvilCorp", role: "Hacker" },
      { messages: [], toolCallId: "call-evil" }
    );
    assert.strictEqual(sandboxedApp.success, false);
    assert.ok(sandboxedApp.error.includes("Acesso negado"));
    console.log(pc.green("✔ Sandbox bloqueou operações fora dos diretórios permitidos!"));

    console.log(pc.bold(pc.green("\n🎉 Todos os 6 grupos de testes do Copiloto de Carreira passaram com 100% de sucesso! 🚀\n")));
  } finally {
    await fs.rm(tempVaultDir, { recursive: true, force: true });
  }
}

runCareerTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste do Copiloto de Carreira:"), err);
  process.exit(1);
});
