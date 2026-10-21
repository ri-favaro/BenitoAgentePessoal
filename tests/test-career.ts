import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import {
  createCareerTools,
  ensureCareerProfileExists,
  readCareerProfile,
  evaluateJobMatch,
  buildConnectionPitch,
  buildTailoredResumeMarkdown,
  buildTailoredPitchAndAtsGuide,
  selectTailoredProjects,
  loadAnalyzedJobs,
  extractJobMetadata,
  cleanJobPostingContent,
  formatJobPipelineKanban,
  buildDynamicStudyMatrix,
} from "../src/tools/career-tools.js";

async function runCareerTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTES DO COPILOTO DE CARREIRA E ANÁLISE DE VAGAS (ISSUE #26 & #39) ===\n")));

  const tempVaultDir = path.resolve(process.cwd(), "tests", "temp-career-vault");
  const allowedDirs = [process.cwd(), tempVaultDir];

  // Limpeza prévia
  await fs.rm(tempVaultDir, { recursive: true, force: true });
  await fs.mkdir(tempVaultDir, { recursive: true });

  const tools = createCareerTools(tempVaultDir, allowedDirs);

  try {
    // ==========================================
    // 1. Testando ensureCareerProfileExists & readCareerProfile
    // ==========================================
    console.log(pc.yellow("1. Testando inicialização, integridade e leitura dinâmica do perfil master..."));
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

    // Testando leitura dinâmica do Markdown
    const profileMarkdown = await readCareerProfile(tempVaultDir, allowedDirs);
    assert.ok(typeof profileMarkdown === "string");
    assert.ok(profileMarkdown.includes("Luiz Ricardo Favaro"));
    assert.ok(profileMarkdown.includes("CONTELE"));
    assert.ok(profileMarkdown.includes("Benito"));
    assert.ok(profileMarkdown.includes("MBA em Engenharia de Software"));
    assert.ok(profileMarkdown.includes("UNISANTA"));
    console.log(pc.green("✔ Perfil master inicializado e lido dinamicamente com 100% de sucesso!"));

    // ==========================================
    // 2. Testando evaluateJobMatch com diferentes perfis de vaga
    // ==========================================
    console.log(pc.yellow("\n2. Testando heurística de aderência calibrada para nível Pleno e novas tecnologias..."));

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

    // Cenário E: Novas tecnologias da Issue #39 (N8N, Claude Anthropic, Inglês Avançado)
    const jobE = `
      Engenheiro de Automações e IA.
      Requisitos: Claude Anthropic com Tool Calling, N8N para criação de fluxos de trabalho e TypeScript.
      Inglês avançado/fluente para comunicação internacional.
    `;
    const resE = evaluateJobMatch(jobE, "Global AI Corp", "Engenheiro de Automações e IA");
    assert.strictEqual(resE.verdict, "Sim");
    assert.ok(resE.matchScore >= 75);
    assert.ok(resE.strengths.some((s) => s.includes("N8N")));
    assert.ok(resE.strengths.some((s) => s.includes("Claude")));
    assert.ok(resE.strengths.some((s) => s.includes("Inglês Avançado")));

    // Cenário F: Tecnologias de Sistemas & Cloud (Go, C/C++/Embarcados, Azure)
    const jobF = `
      Desenvolvedor Backend / IoT Pleno.
      Requisitos: Go (Golang), C / C++ ou sistemas embarcados, Azure e Linux.
    `;
    const resF = evaluateJobMatch(jobF, "IoT Connect", "Desenvolvedor Backend / IoT");
    assert.ok(resF.strengths.some((s) => s.includes("Go (Golang)")));
    assert.ok(resF.strengths.some((s) => s.includes("C/C++") || s.includes("Embarcados")));
    assert.ok(resF.strengths.some((s) => s.includes("Azure")));
    console.log(pc.green("✔ Calibração de aderência para todas as tecnologias do catálogo validada!"));

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
    assert.strictEqual(storedJobs1[0].status, "analisada");

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

    // Adiciona uma terceira vaga via auto-extração de metadados
    const analyzeRes4: any = await tools.analyze_job_posting.execute(
      {
        jobText: jobD,
      },
      { messages: [], toolCallId: "call-4" }
    );
    assert.strictEqual(analyzeRes4.success, true);
    assert.strictEqual(analyzeRes4.company, "Implanta");
    assert.strictEqual(analyzeRes4.role, "Desenvolvedor(a) Harness Multiagente");

    const storedJobs3 = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    assert.strictEqual(storedJobs3.length, 3);
    console.log(pc.green("✔ analyze_job_posting, auto-extração e persistência estruturada em vagas-analisadas.json validados!"));

    // ==========================================
    // 4. Testando Seleção Inteligente de Projetos (selectTailoredProjects)
    // ==========================================
    console.log(pc.yellow("\n4. Testando selectTailoredProjects (Top 2-3 projetos por trilha)..."));
    const backendProjects = selectTailoredProjects(["TypeScript", "Node.js", "PostgreSQL", "Clean Architecture"]);
    assert.ok(backendProjects.length >= 2 && backendProjects.length <= 3);
    assert.ok(backendProjects.some((p) => p.id === "rmda-azure" || p.id === "cobrics-tcc"));
    // Garante que para backend puro o Benito não monopoliza o topo da lista
    assert.strictEqual(backendProjects.some((p) => p.id === "benito"), false);

    const aiProjects = selectTailoredProjects(["TypeScript", "Node.js", "IA Generativa & LLMs", "Agentes de IA & Orquestração"]);
    assert.ok(aiProjects.some((p) => p.id === "benito"));

    const iotProjects = selectTailoredProjects(["C/C++", "Linux", "Sistemas Embarcados", "Azure"]);
    assert.ok(iotProjects.some((p) => p.id === "linux-buildroot" || p.id === "rmda-azure" || p.id === "cobrics-tcc"));
    console.log(pc.green("✔ Seleção adaptativa de projetos calibrada para manter CV conciso!"));

    // ==========================================
    // 5. Testando generate_tailored_application (Arquivos Desacoplados CV & Pitch)
    // ==========================================
    console.log(pc.yellow("\n5. Testando generate_tailored_application com desacoplamento de arquivos..."));

    const appRes: any = await tools.generate_tailored_application.execute(
      {
        company: "Nubank",
        role: "Engenheiro de Software Backend Pleno",
        focusSkills: ["TypeScript", "Node.js", "Clean Architecture", "PostgreSQL"],
      },
      { messages: [], toolCallId: "call-5" }
    );

    assert.strictEqual(appRes.success, true);
    assert.ok(appRes.filePath.includes("Carreira"));
    assert.ok(appRes.cvFilePath.endsWith("-CV.md"));
    assert.ok(appRes.pitchFilePath.endsWith("-Pitch.md"));
    assert.ok(appRes.pitch.includes("Nubank"));
    assert.ok(appRes.pitch.includes("USP/Esalq"));

    // Valida o CV Markdown desacoplado (sem pitch para conversão limpa em PDF/ATS)
    const cvFileContent = await fs.readFile(appRes.cvFilePath, "utf-8");
    assert.ok(cvFileContent.includes("Luiz Ricardo Favaro"));
    assert.ok(cvFileContent.includes("Resumo Profissional"));
    assert.ok(cvFileContent.includes("Competências Técnicas"));
    assert.ok(cvFileContent.includes("CONTELE"));
    assert.ok(cvFileContent.includes("RMDA") || cvFileContent.includes("COBRICS"));
    assert.strictEqual(cvFileContent.includes("## 🎯 Pitch de Conexão"), false); // Desacoplado com sucesso!

    // Valida o Pitch Markdown com Guia ATS
    const pitchFileContent = await fs.readFile(appRes.pitchFilePath, "utf-8");
    assert.ok(pitchFileContent.includes("Pitch de Conexão"));
    assert.ok(pitchFileContent.includes("Guia de Revisão & Otimização ATS"));
    assert.ok(pitchFileContent.includes("Nubank"));

    // Verifica se vinculou cvPath e atualizou status para cv_gerado
    const updatedJobs = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    const nubankJob = updatedJobs.find((j) => j.company === "Nubank");
    assert.ok(nubankJob?.cvPath);
    assert.strictEqual(nubankJob?.status, "cv_gerado");
    assert.ok(appRes.cvPdfFilePath && appRes.cvPdfFilePath.endsWith("-CV.pdf"), "Deve retornar cvPdfFilePath (.pdf)");
    assert.ok(nubankJob?.cvPdfPath && nubankJob.cvPdfPath.endsWith("-CV.pdf"), "Deve salvar cvPdfPath em vagas-analisadas.json");
    const pdfBuf = await fs.readFile(appRes.cvPdfFilePath);
    assert.ok(pdfBuf.byteLength > 500, "Arquivo PDF deve ter conteúdo válido (> 500 bytes)");
    assert.ok(pdfBuf.subarray(0, 7).toString("utf-8").startsWith("%PDF-1."), "Arquivo PDF deve possuir assinatura %PDF-1.");
    assert.strictEqual(cvFileContent.includes("Empresa Alvo:"), false, "Não deve conter metadados internos no CV");
    assert.strictEqual(/[\u{1F300}-\u{1FAFF}]/u.test(cvFileContent), false, "Não deve conter emojis robóticos no CV");
    const idxResumo = cvFileContent.indexOf("## Resumo Profissional");
    const idxExp = cvFileContent.indexOf("## Experiência Profissional");
    const idxComp = cvFileContent.indexOf("## Competências Técnicas");
    const idxForm = cvFileContent.indexOf("## Formação Acadêmica");
    const idxProj = cvFileContent.indexOf("## Projetos de Engenharia Relevantes");
    assert.ok(idxResumo < idxExp && idxExp < idxComp && idxComp < idxForm && idxForm < idxProj, "Deve respeitar a ordem aprovada das seções");

    // Testa re-renderização via export_resume_pdf após edição manual no Obsidian
    const editedMd = cvFileContent.replace("Engenheiro de Software Backend Pleno", "Engenheiro de Software Backend Pleno (Editado Obsidian)");
    await fs.writeFile(appRes.cvFilePath, editedMd, "utf-8");
    const exportRes: any = await (tools as any).export_resume_pdf.execute(
      { company: "Nubank" },
      { messages: [], toolCallId: "call-export-pdf" }
    );
    assert.strictEqual(exportRes.success, true, "export_resume_pdf deve re-gerar o PDF com sucesso");
    assert.ok(exportRes.sizeBytes > 500, "PDF re-gerado deve possuir tamanho válido");
    console.log(pc.green("✔ CV desacoplado e Pitch + Guia ATS gerados com status atualizado para 'cv_gerado'!"));

    // ==========================================
    // 6. Testando update_job_application_status (Funil de Vagas)
    // ==========================================
    console.log(pc.yellow("\n6. Testando ferramenta update_job_application_status..."));

    const updateRes1: any = await tools.update_job_application_status.execute(
      {
        company: "Nubank",
        status: "aplicada",
        notes: "Candidatura submetida via LinkedIn Easy Apply",
      },
      { messages: [], toolCallId: "call-6" }
    );

    assert.strictEqual(updateRes1.success, true);
    assert.strictEqual(updateRes1.status, "aplicada");
    assert.strictEqual(updateRes1.notes, "Candidatura submetida via LinkedIn Easy Apply");

    // Mudança para etapa de entrevista
    const updateRes2: any = await tools.update_job_application_status.execute(
      {
        company: "Nubank",
        status: "entrevista",
        notes: "Entrevista técnica com Tech Lead agendada",
      },
      { messages: [], toolCallId: "call-7" }
    );
    assert.strictEqual(updateRes2.success, true);
    assert.strictEqual(updateRes2.status, "entrevista");

    // Tentativa em empresa inexistente deve retornar erro amigável
    const updateResFail: any = await tools.update_job_application_status.execute(
      {
        company: "EmpresaFantasmaXYZ",
        status: "rejeitada",
      },
      { messages: [], toolCallId: "call-8" }
    );
    assert.strictEqual(updateResFail.success, false);
    assert.ok(updateResFail.error.includes("não encontrada"));
    console.log(pc.green("✔ update_job_application_status manipulou transições de status com sucesso!"));

    // ==========================================
    // 7. Testando formatJobPipelineKanban
    // ==========================================
    console.log(pc.yellow("\n7. Testando visualização textual do funil Kanban..."));
    const currentJobs = await loadAnalyzedJobs(tempVaultDir, allowedDirs);
    const kanbanOutput = formatJobPipelineKanban(currentJobs);

    assert.ok(kanbanOutput.includes("📊 FUNIL DE CANDIDATURAS"));
    assert.ok(kanbanOutput.includes("ENTREVISTA"));
    assert.ok(kanbanOutput.includes("Nubank"));
    assert.ok(kanbanOutput.includes("ANALISADAS"));
    assert.ok(kanbanOutput.includes("Implanta"));
    console.log(pc.green("✔ Visualização do Kanban de vagas formatada com clareza!"));

    // ==========================================
    // 8. Testando generate_career_report e matriz de estudos dinâmica
    // ==========================================
    console.log(pc.yellow("\n8. Testando generate_career_report e matriz dinâmica de estudos..."));

    const reportRes: any = await tools.generate_career_report.execute(
      { updateVaultNote: true },
      { messages: [], toolCallId: "call-9" }
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
    assert.ok(noteContent.includes("**Total de Vagas Analisadas:** 3"));

    // Testando buildDynamicStudyMatrix com gaps
    const dynamicMatrixResult = buildDynamicStudyMatrix(
      currentJobs,
      reportRes.topSkills,
      reportRes.topCriticalGaps || [],
      reportRes.topQuickWins || []
    );
    assert.ok(Array.isArray(dynamicMatrixResult.studyMatrix));
    assert.ok(dynamicMatrixResult.studyMatrix.length > 0);
    assert.ok(dynamicMatrixResult.studyMatrix.some((m) => m.area && m.action && m.localResource));
    assert.ok(typeof dynamicMatrixResult.weeklyStudyFocus === "string");
    console.log(pc.green("✔ generate_career_report e matriz dinâmica consolidados com maestria!"));

    // ==========================================
    // 9. Testando Proteção de Sandbox (path-guard)
    // ==========================================
    console.log(pc.yellow("\n9. Testando proteção estrita de sandbox com path-guard..."));

    const evilTools = createCareerTools("C:\\Windows\\System32", allowedDirs);
    const sandboxedApp: any = await evilTools.generate_tailored_application.execute(
      { company: "EvilCorp", role: "Hacker" },
      { messages: [], toolCallId: "call-evil" }
    );
    assert.strictEqual(sandboxedApp.success, false);
    assert.ok(sandboxedApp.error.includes("Acesso negado"));
    console.log(pc.green("✔ Sandbox bloqueou operações fora dos diretórios permitidos!"));

    console.log(pc.bold(pc.green("\n🎉 Todos os 9 grupos de testes do Copiloto de Carreira passaram com 100% de sucesso! 🚀\n")));
  } finally {
    await fs.rm(tempVaultDir, { recursive: true, force: true });
  }
}

runCareerTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste do Copiloto de Carreira:"), err);
  process.exit(1);
});
