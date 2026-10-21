import fs from "node:fs/promises";
import path from "node:path";
import { tool, generateText } from "ai";
import { z } from "zod";
import { validateAllowedPath } from "./path-guard.js";
import { cleanMarkdownContent, extractPageText } from "./web-tools.js";
import { getLanguageModel } from "../core/llm.js";
import { renderResumeMarkdownToPdf } from "../core/resume-pdf-renderer.js";

export type JobApplicationStatus =
  | "analisada"
  | "cv_gerado"
  | "aplicada"
  | "entrevista"
  | "rejeitada"
  | "oferta";

export interface AnalyzedJobRecord {
  id: string;
  date: string;
  company: string;
  role: string;
  url?: string;
  level: "junior" | "pleno" | "senior" | "outros";
  matchScore: number; // 0 a 100
  verdict: "Sim" | "Com ressalvas" | "Não";
  verdictReason: string;
  strengths: string[];
  quickWins: string[];
  criticalGaps: string[];
  keyTechnologies: string[];
  cvPath?: string;
  cvPdfPath?: string;
  pitchPath?: string;
  status?: JobApplicationStatus;
  statusUpdatedAt?: string;
  notes?: string;
}

export interface CareerMarketReport {
  timestamp: string;
  totalJobsAnalyzed: number;
  averageMatchScore: number;
  verdictDistribution: {
    sim: number;
    comRessalvas: number;
    nao: number;
  };
  topSkillsDemand: Array<{ skill: string; count: number; percentage: number }>;
  topQuickWins: Array<{ gap: string; count: number }>;
  topCriticalGaps: Array<{ gap: string; count: number }>;
  studyMatrix: Array<{
    area: string;
    action: string;
    localResource?: string;
    effort: "Baixo" | "Médio" | "Alto";
    marketImpact: "Alto" | "Muito Alto" | "Crítico";
    priority: "Alta" | "Média";
  }>;
  weeklyStudyFocus?: string;
}

/**
 * Conteúdo padrão para inicialização do Perfil Profissional Master de Luiz Ricardo Favaro.
 */
export const INITIAL_CAREER_PROFILE_CONTENT = `# 👨‍💻 Perfil Profissional Master - Luiz Ricardo Favaro

> **Aviso ao Benito:** Este documento é a **única fonte da verdade** sobre o histórico técnico, acadêmico, profissional e projetos práticos de Luiz Ricardo Favaro. **Nunca invente** tecnologias, experiências profissionais, empresas ou cargos não listados aqui.

---

## 📌 Dados Pessoais & Contato

- **Nome Completo:** Luiz Ricardo Favaro
- **Título Base:** Engenheiro da Computação | Desenvolvedor de Software (Backend, Integrações & IA)
- **Localização:** Guarujá, São Paulo (atuando em Santos, SP)
- **E-mail:** ricardofavaro6@gmail.com
- **Telefone / WhatsApp:** (13) 98174-8698
- **LinkedIn:** https://www.linkedin.com/in/ri-favaro/
- **GitHub:** https://github.com/ri-favaro
- **Idiomas:**
  - **Português:** Nativo
  - **Inglês:** Avançado
  - **Espanhol:** Intermediário

---

## 🎯 Resumo Executivo & Posicionamento Estratégico

- **Formação Principal:** Bacharel em Engenharia da Computação — Universidade Santa Cecília (UNISANTA, concluído em 2024 com nota máxima no TCC e publicação na COBRICS).
- **Pós-Graduação:** MBA em Engenharia de Software — USP/ESALQ (cursando).
- **Atuação Profissional Atual:** Desenvolvedor de Integrações & Software na **Contele** (Santos, SP), com foco em **Node.js**, **TypeScript**, **Integrações de APIs REST**, **N8N**, **LLMs (Claude / Anthropic)** e desenvolvimento fullstack no ecossistema **CONTELE-OS** (Next.js, React, PostgreSQL/Supabase).
- **Alvo Estratégico de Carreira:** Vagas de **Desenvolvedor / Engenheiro de Software Pleno (Mid-level)** (Backend, Integrações, Fullstack ou Engenharia de IA/Agentes).
- **Regra de Posicionamento (Calibração Pleno):** Evitar termos de ancoragem júnior (como *"profissional em início de carreira buscando aprender"*). Posicionar como **Engenheiro de Software com entrega comprovada em produção** (automação ponta a ponta de APIs críticas, LLMs em produção, arquitetura limpa e sistemas distribuídos).

---

## 💼 Experiência Profissional Real

### 1. Contele — Desenvolvedor de Integrações · Foco em IA e Automações
- **Período:** abr/2026 – atual | **Local:** Santos, SP
- **Stack em Produção:** Node.js, TypeScript, N8N, APIs REST, LLMs (Claude / Anthropic), Next.js, React, Supabase (PostgreSQL), Tailwind CSS, Zod, Jest, Git/GitHub.
- **Realizações & Entregas Comprovadas:**
  - **Automação Logística & Correios Ponta a Ponta:** Arquitetura e desenvolvimento de integração com as APIs REST dos Correios (cotação comparativa Correios vs transportadoras, pré-postagem automática, emissão de etiquetas em PDF e geração de comprovantes detalhados de logística reversa na troca de equipamentos), eliminando gargalos operacionais e erros manuais.
  - **Dashboard de Rastreamento em Tempo Real:** Desenvolvimento de interface visual integrada à API Rastro dos Correios, com identificação automática de atrasos operacionais, filtros dinâmicos de status (Em trânsito, Aguardando retirada, Entregue, Atrasado) e busca inteligente por destinatário ou código de envio.
  - **Integrações de Negócio & Workflows N8N:** Construção de pipelines corporativos de automação utilizando Node.js, TypeScript e N8N, orquestrando fluxos com Pipedrive (CRM), Asana (sincronização de tarefas e anexos de marketing/projetos) e grupos de WhatsApp corporativo via webhooks e mensageria assíncrona.
  - **Engenharia de IA & LLMs em Produção:** Implementação de fluxos com Claude (Anthropic) para triagem inteligente de dados operacionais, abertura assistida de demandas e automação da auditoria de predição de churn para equipes de Customer Success (CS).
  - **Desenvolvimento Fullstack no CONTELE-OS:** Desenvolvimento de módulos críticos com Next.js (App Router), React, TypeScript e Supabase (PostgreSQL), modelagem relacional com views otimizadas, migrações versionadas em SQL, validação estrita de runtime com Zod e testes unitários com Jest sob metodologia ágil Kanban.

### 2. O Especialista — Suporte de TI & Infraestrutura
- **Período:** jun/2024 – dez/2024 (6 meses) | **Local:** Guarujá, SP
- **Realizações & Entregas Comprovadas:**
  - Prestação de suporte técnico nível 1 e 2 (presencial e remoto) atendendo simultaneamente de 4 a 5 empresas clientes corporativas.
  - Diagnóstico avançado de incidentes críticos de TI, configuração de redes locais (TCP/IP, roteamento, firewalls), infraestrutura e manutenção de hardware com foco em SLA e alta disponibilidade.
  - Atuação direta com stakeholders e resolução rápida de problemas sob pressão operacional.

---

## 🛠️ Habilidades Técnicas & Stacks Dominadas

### 💻 Linguagens de Programação
- **Principais (Foco Software & IA):** TypeScript, JavaScript (ES2023+ / Node.js), Python, SQL.
- **Sistemas, Tipadas & Embarcados (Background Engenharia):** Go (Golang), C#, C, C++.
- **Secundárias / Acadêmicas (Omitir em vagas puras de Web/Backend, usar apenas se a vaga pedir IoT/Automação Industrial):** Assembly, Ladder (CLPs), HTML5, CSS3.

### 🌐 Backend, Integrações & Frontend
- **Backend & Runtimes:** Node.js (v20+ / v22+, ESM nativo), APIs RESTful (design, autenticação, consumo, webhooks, geração de PDFs), Express, validação estrita com Zod.
- **Automações & Workflows:** N8N (fluxos complexos, webhooks, integrações com IA e sistemas externos).
- **Frontend & Web:** React, Next.js (App Router, Server Components, Server Actions), Tailwind CSS.

### 🤖 Inteligência Artificial, LLMs & Dados Vetoriais
- **Engenharia de IA & Agentes:** Integração produtiva com APIs de LLMs (Anthropic Claude, Google Gemini, OpenAI) e modelos locais via Ollama (Qwen 3.5) e \`llama-server\`.
- **Orquestração & SDKs:** Vercel AI SDK, Tool Calling, Streaming Parsers (FSM), Decoupled Reasoning (\`<thinking>\`), Agentes Autônomos e N8N AI Agents.
- **RAG & Bancos Vetoriais:** LanceDB (busca semântica vetorial local), EmbeddingGemma-2 (768d), chunking estrutural e indexação incremental com hash SHA-256.

### 🗄️ Bancos de Dados, Cloud & DevOps
- **Bancos de Dados:** PostgreSQL (Supabase, modelagem relacional, índices, joins, migrations SQL), MySQL, SQLite, Firebase (Realtime Database).
- **DevOps, Cloud & Ferramentas:** Docker (Dockerfile multi-stage, Docker Compose), Git, GitHub (GitHub Actions, CLI \`gh\`, REST API), Microsoft Azure (VMs e processamento em nuvem), Linux (servidor e embarcado).
- **Qualidade & Engenharia:** Testes unitários e de integração (Jest, Node.js Test Runner), Clean Architecture, Domain-Driven Design (DDD), TDD, Kanban.

---

## 🚀 Projetos de Engenharia & Pesquisa Aplicada

### 1. Benito — Assistente Autônomo & Engenharia de IA (2026)
- **Repositório:** \`https://github.com/ri-favaro/BenitoAgentePessoal\`
- **Stack:** Node.js 22+, TypeScript 5.8+, Vercel AI SDK, Ollama, LanceDB, EmbeddingGemma-2, grammY, Zod, Jest.
- **Destaques para o CV:**
  - Arquitetura modular de agentes autônomos com execução de ferramentas (tool calling) e streaming em tempo real.
  - Motor local de RAG vetorial com LanceDB e EmbeddingGemma-2 (768d) otimizado (~270MB RAM) com indexação incremental via SHA-256.
  - Sandbox estrito de segurança no sistema de arquivos e execução de comandos de terminal com whitelist de processos.
  - Cobertura completa de testes automatizados com Jest (14 suítes) validando regras de negócio, integrações REST/CLI e persistência.

### 2. TCC Premiado & Publicado na COBRICS (Jan – Dez 2024)
- **Título:** *Aprendizado e Diversão: Uma abordagem tecnológica com jogos lúdico-musicais na infância*
- **Stack:** C/C++ (ESP32), Sensores RFID, Firebase, Android, Prototipagem Eletrônica.
- **Destaques para o CV:**
  - Arquitetura ponta a ponta integrando hardware embarcado (**ESP32** + **RFID**), sincronização em nuvem em tempo real (**Firebase**) e aplicativo móvel (**Android**).
  - Validado em campo com crianças (4 a 8 anos) e pedagogos; obteve **nota máxima (10)** na banca de Engenharia da Computação e **artigo científico publicado no congresso COBRICS 2024**.

### 3. RMDA — Robô de Monitoramento de Ambientes em Nuvem (Jan – Jul 2023)
- **Repositório:** \`https://github.com/ri-favaro/Projeto-IOT-23\`
- **Stack:** Microsoft Azure (VM), LoRaWAN, The Things Network (TTN), IoT, Dashboard Gráfico.
- **Destaques para o CV:**
  - Prova de conceito de telemetria distribuída com transmissão de dados de longo alcance via **LoRaWAN/TTN** para servidor e processamento em **VM Microsoft Azure** com dashboard gráfico em tempo real.

### 4. Sistema Operacional Linux Customizado com Buildroot (2023)
- **Repositório:** \`https://github.com/ri-favaro/Primeiro-sistema-operacional-proprio\`
- **Stack:** Linux Embarcado, Buildroot, Shell Script, Raspberry Pi 4.
- **Destaques para o CV:**
  - Compilação e otimização de imagem de Sistema Operacional Linux enxuto do zero utilizando **Buildroot** e **Shell Script** para execução dedicada em hardware Raspberry Pi 4.

### 5. Algoritmo Widrow-Hoff — Machine Learning Supervisionado (Ago – Out 2023)
- **Repositório:** \`https://github.com/ri-favaro/Algoritmo-baseado-no-m-todo-WidrowHoff---HTML\`
- **Stack:** JavaScript, HTML5, CSS3, Machine Learning Clássico.
- **Destaques para o CV:**
  - Implementação interativa do algoritmo de aprendizado supervisionado Widrow-Hoff (LMS) com visualização matemática de convergência em tempo real no navegador.

---

## 🎓 Formação Acadêmica

### 1. MBA em Engenharia de Software — USP / ESALQ (Cursando)
- **Foco:** Arquitetura de Software (Clean Architecture, Hexagonal), Domain-Driven Design (DDD), Microsserviços, Mensageria Assíncrona (RabbitMQ, Kafka), Test-Driven Development (TDD), DevOps & CI/CD.

### 2. Bacharelado em Engenharia da Computação — Universidade Santa Cecília (UNISANTA) (Completo em Dez/2024)
- **Foco:** Estruturas de Dados, Algoritmos, Sistemas Operacionais, Redes de Computadores, Sistemas Distribuídos, Engenharia de Software e Sistemas Embarcados.
- **Destaque Acadêmico:** Autor de artigo publicado na COBRICS 2024 e nota máxima no Trabalho de Conclusão de Curso.

---

## 🎯 Diretrizes Obrigatórias para Adaptação de Currículo (Regras para o Benito)

1. **Zero Alucinação & Fidelidade Absoluta:** Use exclusivamente os dados de contato, empresas (\`Contele\`, \`O Especialista\`), projetos (\`Benito\`, \`TCC COBRICS\`, \`RMDA Azure\`, \`Linux Buildroot\`, \`Widrow-Hoff\`), formação (\`UNISANTA\`, \`MBA USP/ESALQ\`) e idiomas (\`Inglês Avançado\`, \`Espanhol Intermediário\`) deste documento.
2. **Prioridade Máxima às Entregas de Produção da Contele:** Destaque sempre o impacto real de negócio em produção (integrações de APIs Correios, rastreamento, N8N, Supabase/PostgreSQL, CONTELE-OS e IA aplicada com Claude).
3. **Seleção Contextual de Projetos (Sem Monopólio do Benito):**
   - Para vagas de **IA Generativa / LLMs / Agentes**: inclua o **Benito** com foco em engenharia de software (tool calling, RAG local, 14 suítes de testes Jest).
   - Para vagas gerais de **Backend / Fullstack / DevOps / Sistemas**: priorize projetos de infraestrutura e engenharia distribuída (**RMDA Azure**, **TCC COBRICS** ou **Linux Buildroot**), mantendo o foco das experiências profissionais na Contele.
4. **Filtro de Relevância por Vaga:**
   - Destaque \`TypeScript\`, \`Node.js\`, \`PostgreSQL\`, \`SQL\`, \`APIs REST\`, \`Docker\`, \`Next.js\`, \`React\`, \`N8N\`, \`Claude\`, \`Jest\` e \`Azure\`. Omita ferramentas industriais/CAD não pertinentes a software.
5. **Tom de Nível Pleno:** Posicione como *"Engenheiro da Computação e Desenvolvedor de Software (pós-graduando em Engenharia de Software pela USP/ESALQ) com experiência prática em produção no desenvolvimento de APIs REST, integrações complexas, aplicações Fullstack (Node.js/TypeScript/React) e soluções com IA Generativa/LLMs"*.
6. **Destaque do Inglês Avançado:** Sempre inclua a seção de Idiomas destacando **Inglês Avançado**, diferencial competitivo forte para vagas Pleno.
`;

/**
 * Garante que a pasta Carreira/ e o perfil-profissional.md existam no cofre do Obsidian.
 */
export async function ensureCareerProfileExists(
  vaultPath: string,
  allowedPaths: string[] = [vaultPath]
): Promise<{ filePath: string; created: boolean }> {
  const carreiraDir = path.join(vaultPath, "Carreira");
  const profileFile = path.join(carreiraDir, "perfil-profissional.md");

  const check = validateAllowedPath(profileFile, allowedPaths);
  if (!check.allowed) {
    throw new Error(check.error || "Acesso negado ao diretório do cofre.");
  }

  await fs.mkdir(carreiraDir, { recursive: true });

  try {
    await fs.access(profileFile);
    return { filePath: profileFile, created: false };
  } catch {
    await fs.writeFile(profileFile, INITIAL_CAREER_PROFILE_CONTENT, "utf-8");
    return { filePath: profileFile, created: true };
  }
}

/**
 * Lê dinamicamente o conteúdo de Carreira/perfil-profissional.md do cofre do Obsidian.
 */
export async function readCareerProfile(
  vaultPath: string,
  allowedPaths: string[] = [vaultPath]
): Promise<string> {
  const { filePath } = await ensureCareerProfileExists(vaultPath, allowedPaths);
  const check = validateAllowedPath(filePath, allowedPaths);
  if (!check.allowed) {
    throw new Error(check.error || "Acesso negado ao perfil profissional.");
  }
  return await fs.readFile(filePath, "utf-8");
}

/**
 * Extrai metadados do cargo e empresa a partir do texto e cabeçalhos da vaga.
 */
export function extractJobMetadata(
  text: string,
  url?: string
): { company?: string; role?: string } {
  let company: string | undefined;
  let role: string | undefined;

  // 1. Título do LinkedIn: "Title: <Empresa> hiring <Cargo> in <Local> | LinkedIn"
  const linkedinTitleMatch = text.match(/Title:\s*([^|\n\r]+?)\s+hiring\s+([^|\n\r]+?)\s+(?:in|em)\s+[^|\n\r]+/i);
  if (linkedinTitleMatch) {
    company = linkedinTitleMatch[1].trim();
    role = linkedinTitleMatch[2].trim();
  }

  // 2. Formato alternativo de título: "Title: <Cargo> at <Empresa>" ou "Title: <Cargo> - <Empresa>"
  if (!company || !role) {
    const atMatch = text.match(/Title:\s*([^|\n\r]+?)\s+(?:at|na|no|@)\s+([^|\n\r]+?)(?:\s*\||\s*[-–—]|$)/im);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    }
  }

  if (!company || !role) {
    const dashMatch = text.match(/Title:\s*([^|\n\r]+?)\s+[-–—]\s+([^|\n\r]+?)(?:\s*[-–—]|\s*\||$)/im);
    if (dashMatch) {
      role = dashMatch[1].trim();
      company = dashMatch[2].trim();
    }
  }

  // 3. Padrão no corpo do LinkedIn: "# <Cargo>" seguido de "#### [<Empresa>]" ou "[<Empresa>](https://...)"
  if (!role) {
    const h1Match = text.match(/^#\s+([^\n\r]+)/m);
    if (h1Match && !h1Match[1].toLowerCase().includes("skip") && !h1Match[1].toLowerCase().includes("sign in")) {
      role = h1Match[1].trim();
    }
  }

  if (!company) {
    const compMatch = text.match(/####\s*\[([^\]]+)\]/i) || text.match(/role at \*\*([^*]+)\*\*/i);
    if (compMatch) {
      company = compMatch[1].trim();
    }
  }

  // 4. Se ainda não encontrou empresa ou cargo, analisa as primeiras linhas limpas do texto
  if (!company || !role) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("http") && !l.startsWith("[Skip"));

    const noiseRegex = /^(?:sign in|join now|skip to|linkedin|expand search|clear text|apply|save|report this job|use ai to)/i;
    const cleanLines = lines.filter((l) => !noiseRegex.test(l));

    if (cleanLines.length >= 2) {
      if (!role && cleanLines[0].length < 80) {
        role = cleanLines[0].replace(/^#+\s*/, "").trim();
      }
      if (!company && cleanLines[1].length < 60) {
        company = cleanLines[1].replace(/^[#\-\*]+\s*/, "").replace(/\[([^\]]+)\](?:\([^\)]+\))?/, "$1").trim();
      }
    }
  }

  // 5. Limpeza adicional se o cargo capturado contiver sufixos comuns
  if (role) {
    role = role.replace(/\s*\|\s*LinkedIn$/i, "").trim();
  }
  if (company) {
    company = company.replace(/^(hiring|empresa)\s+/i, "").trim();
  }

  return { company, role };
}

/**
 * Remove seções de rodapé (vagas recomendadas/similares) e modais repetitivos de login.
 */
export function cleanJobPostingContent(content: string, maxLength: number = 15000): string {
  let cleaned = content;

  // 1. Corte de seções irrelevantes de rodapé (Similar jobs, vagas relacionadas, etc.)
  const cutoffPatterns = [
    /\n\s*##?\s*Similar jobs/i,
    /\n\s*##?\s*Vagas similares/i,
    /\n\s*##?\s*Vagas semelhantes/i,
    /\n\s*##?\s*Outras vagas/i,
    /\n\s*##?\s*Explore similar jobs/i,
    /\n\s*Similar jobs/i,
    /\n\s*People also viewed/i,
    /\n\s*Quem viu esta vaga também viu/i,
    /\n\s*Get notified about new.*jobs/i,
    /\n\s*Receba notificações de novas vagas/i,
  ];

  for (const pattern of cutoffPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index !== undefined) {
      cleaned = cleaned.slice(0, match.index);
    }
  }

  // 2. Remove modais repetitivos de login do LinkedIn
  cleaned = cleaned.replace(/Join to apply for the[^\n]*role at[^\n]*/gi, "");
  cleaned = cleaned.replace(/Sign in to access AI-powered advices[\s\S]*?Cookie Policy\.\)/gi, "");
  cleaned = cleaned.replace(/Sign in to evaluate your skills[\s\S]*?Cookie Policy\.\)/gi, "");
  cleaned = cleaned.replace(/Sign in to tailor your resume[\s\S]*?Cookie Policy\.\)/gi, "");
  cleaned = cleaned.replace(/Continue with Google[\s\S]*?Cookie Policy\.\)/gi, "");
  cleaned = cleaned.replace(/New to LinkedIn\? Join now/gi, "");

  // 3. Aplica limpeza geral de markdown e limita tamanho sem perder a descrição
  return cleanMarkdownContent(cleaned, maxLength);
}

/**
 * Busca conteúdo textual de uma URL de vaga (usando Jina Reader com fallback HTML).
 */
export async function fetchJobPostingContent(url: string): Promise<string> {
  const cleanUrl = url.trim();

  // Tentativa primária: Jina Reader (renderiza SPAs React/Next.js/Gupy/LinkedIn)
  try {
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
    const jinaRes = await fetch(jinaUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "text/plain",
        "X-No-Cache": "true",
        "User-Agent": "BenitoCareerAssistant/1.0",
      },
    });

    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text && text.length > 200) {
        // Preserva a linha Title: para extração precisa de empresa e cargo
        let titleLine = "";
        const titleMatch = text.match(/^(Title:[^\n\r]+)/m);
        if (titleMatch) {
          titleLine = titleMatch[1] + "\n\n";
        }

        const contentStart = text.indexOf("Markdown Content:");
        const raw = contentStart !== -1 ? text.slice(contentStart + 17).trim() : text.trim();
        return cleanJobPostingContent(titleLine + raw, 15000);
      }
    }
  } catch {
    // Falha do Jina Reader, segue para fallback local
  }

  // Fallback: fetch HTTP padrão
  const response = await fetch(cleanUrl, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "text/html,text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao acessar URL da vaga (${response.status}: ${response.statusText})`);
  }

  const html = await response.text();
  const extracted = extractPageText(html, 15000);
  return cleanJobPostingContent(extracted.content, 15000);
}

/**
 * Carrega a lista consolidada de vagas analisadas de Carreira/vagas-analisadas.json.
 */
export async function loadAnalyzedJobs(
  vaultPath: string,
  allowedPaths: string[] = [vaultPath]
): Promise<AnalyzedJobRecord[]> {
  const jsonPath = path.join(vaultPath, "Carreira", "vagas-analisadas.json");
  const check = validateAllowedPath(jsonPath, allowedPaths);
  if (!check.allowed) return [];

  try {
    const data = await fs.readFile(jsonPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Salva ou atualiza uma vaga na lista em Carreira/vagas-analisadas.json.
 */
export async function saveAnalyzedJob(
  vaultPath: string,
  record: AnalyzedJobRecord,
  allowedPaths: string[] = [vaultPath]
): Promise<void> {
  const carreiraDir = path.join(vaultPath, "Carreira");
  const jsonPath = path.join(carreiraDir, "vagas-analisadas.json");

  const check = validateAllowedPath(jsonPath, allowedPaths);
  if (!check.allowed) {
    throw new Error(check.error || "Acesso negado para salvar JSON de vagas.");
  }

  await fs.mkdir(carreiraDir, { recursive: true });

  const existing = await loadAnalyzedJobs(vaultPath, allowedPaths);
  const index = existing.findIndex(
    (item) => item.id === record.id || (item.url && record.url && item.url === record.url)
  );

  if (index >= 0) {
    existing[index] = { ...existing[index], ...record };
  } else {
    existing.unshift(record);
  }

  await fs.writeFile(jsonPath, JSON.stringify(existing, null, 2), "utf-8");
}

/**
 * Heurística de análise técnica calibrada para o nível Pleno.
 */
export function evaluateJobMatch(
  jobText: string,
  companyName: string = "Empresa",
  roleName: string = "Desenvolvedor Backend / Fullstack Pleno"
): {
  level: "junior" | "pleno" | "senior" | "outros";
  matchScore: number;
  verdict: "Sim" | "Com ressalvas" | "Não";
  verdictReason: string;
  strengths: string[];
  quickWins: string[];
  criticalGaps: string[];
  keyTechnologies: string[];
} {
  const lower = jobText.toLowerCase();
  const lowerRole = roleName.toLowerCase();

  // 1. Detecção de Nível Calibrada
  let level: "junior" | "pleno" | "senior" | "outros" = "pleno";
  if (/\b(senior|sênior|sr\.?|lead|tech lead|especialista|staff|principal)\b/i.test(lowerRole)) {
    level = "senior";
  } else if (/\b(junior|júnior|jr\.?|estagio|estágio)\b/i.test(lowerRole)) {
    level = "junior";
  } else if (/\b(pleno|mid|pl)\b/i.test(lowerRole)) {
    level = "pleno";
  } else {
    // Se o cargo anunciado for genérico/neutro, analisa o corpo da vaga
    const acceptsPleno = /pleno ou s[êe]nior|pleno\/s[êe]nior|mid-senior|nível pleno|pleno|mid-level/i.test(lower);
    if (acceptsPleno) {
      level = "pleno";
    } else if (/\b(senior|sênior|lead|tech lead|staff|especialista)\b/i.test(lower)) {
      level = "senior";
    }
  }

  // 2. Mapeamento de Tecnologias Relevantes na Vaga (Expandido com competências reais do perfil)
  const techCatalog: Record<string, RegExp> = {
    "TypeScript": /\b(typescript|ts)\b/i,
    "Node.js": /\b(node|nodejs|node\.js)\b/i,
    "SQL / PostgreSQL": /\b(sql|postgres|postgresql|relational|rdbms|pgvector)\b/i,
    "Docker": /\b(docker|container|containers|compose)\b/i,
    "Next.js": /\b(next\.js|nextjs|next)\b/i,
    "React": /\b(react|reactjs|react\.js)\b/i,
    "APIs REST": /\b(rest|restful|api|apis)\b/i,
    "IA Generativa & LLMs": /\b(ia generativa|genai|llm|llms|engenharia de prompts?|prompt engineering|openai|gemini|modelos de linguagem|modelos abertos)\b/i,
    "Claude & Anthropic": /\b(claude|anthropic)\b/i,
    "Agentes de IA & Orquestração": /\b(agentes?|multiagente|multi-agent|orquestra[çc][ãa]o de agentes|langchain|langgraph|llamaindex|crewai|autogen|tool calling|chamada de ferramentas|harness)\b/i,
    "N8N & Automação de Workflows": /\b(n8n|workflow automation|automa[çc][ãa]o de fluxos?|webhooks?)\b/i,
    "Bases Vetoriais & RAG": /\b(rag|embeddings?|pgvector|lancedb|banco[s]? vetoria[il]|bases vetoriais|busca sem[âa]ntica|chunking|vector search)\b/i,
    "Python": /\b(python|fastapi|django|flask)\b/i,
    "Go (Golang)": /\b(golang|go)\b/i,
    "C/C++ & Embarcados": /\b(c\+\+|embedded|embarcados?|iot|esp32|microcontrolador|lorawan)\b/i,
    "Microsoft Azure & Firebase": /\b(azure|firebase)\b/i,
    "Clean Architecture": /\b(clean architecture|hexagonal|arquitetura limpa|camadas|ports and adapters)\b/i,
    "Domain-Driven Design (DDD)": /\b(ddd|domain-driven|domain driven)\b/i,
    "Mensageria (RabbitMQ / Kafka)": /\b(rabbitmq|kafka|mensageria|filas|queues|pub\/sub|sqs|event-driven)\b/i,
    "TDD / Testes Automatizados": /\b(tdd|testes unitarios|testes unitários|jest|test-driven|testes de integracao|testes automatizados)\b/i,
    "Microsserviços": /\b(microservices|microsserviços|microsservicos|distributed systems|sistemas distribuídos)\b/i,
    "CI/CD": /\b(ci\/cd|pipeline|github actions|gitlab ci|jenkins)\b/i,
    "Cloud (AWS / GCP)": /\b(aws|amazon web services|gcp|google cloud)\b/i,
    "Kubernetes": /\b(kubernetes|k8s)\b/i,
    "GraphQL": /\b(graphql)\b/i,
    "NoSQL / MongoDB / Redis": /\b(nosql|mongo|mongodb|redis|dynamodb)\b/i,
    "Inglês Avançado / Fluente": /\b(ingl[êe]s (?:avan[çc]ado|fluente)|english (?:advanced|fluent))\b/i,
    "Java / Spring Boot": /\b(java|spring|spring boot)\b/i,
    "C# / .NET": /\b(c#|\.net|dotnet|asp\.net)\b/i,
  };

  const detectedTechs: string[] = [];
  for (const [tech, regex] of Object.entries(techCatalog)) {
    if (regex.test(lower)) {
      detectedTechs.push(tech);
    }
  }

  // 3. Classificação em Pontos Fortes, Quick Wins e Gaps Críticos
  const strengths: string[] = [];
  const quickWins: string[] = [];
  const criticalGaps: string[] = [];

  // Núcleo de domínio comprovado no perfil real
  if (detectedTechs.includes("TypeScript")) strengths.push("TypeScript (Tipagem estrita, Zod e arquitetura modular)");
  if (detectedTechs.includes("Node.js")) strengths.push("Node.js (APIs assíncronas, backend moderno em ESM nativo)");
  if (detectedTechs.includes("SQL / PostgreSQL")) strengths.push("SQL / PostgreSQL (Modelagem relacional, queries e migrações no CONTELE-OS)");
  if (detectedTechs.includes("Docker")) strengths.push("Docker (Conteinerização, multi-stage builds e compose)");
  if (detectedTechs.includes("Next.js") || detectedTechs.includes("React")) strengths.push("Next.js / React (Experiência prática no CONTELE-OS)");
  if (detectedTechs.includes("APIs REST")) strengths.push("APIs RESTful (Design limpo, boas práticas HTTP, geração de PDFs e rastreamento Correios na Contele)");
  if (detectedTechs.includes("IA Generativa & LLMs")) strengths.push("IA Generativa & LLMs (Aplicações em produção na Contele, Claude/Anthropic e engenharia de prompts)");
  if (detectedTechs.includes("Claude & Anthropic")) strengths.push("Claude & Anthropic (Aplicações produtivas de automação na Contele)");
  if (detectedTechs.includes("Agentes de IA & Orquestração")) strengths.push("Agentes de IA & Orquestração (Arquitetura modular com Vercel AI SDK, tool calling e automações N8N)");
  if (detectedTechs.includes("N8N & Automação de Workflows")) strengths.push("N8N & Automação de Workflows (Fluxos complexos, webhooks e integrações produtivas na Contele)");
  if (detectedTechs.includes("Bases Vetoriais & RAG")) strengths.push("Bases Vetoriais & RAG (Pipeline de busca semântica vetorial com LanceDB, embeddings locais e indexação incremental)");
  if (detectedTechs.includes("Python")) strengths.push("Python (Conhecimento prático para automações, APIs e scripts utilitários)");
  if (detectedTechs.includes("Go (Golang)")) strengths.push("Go (Golang) (Conhecimento prático de linguagem tipada e compilada)");
  if (detectedTechs.includes("C/C++ & Embarcados")) strengths.push("C/C++ & Sistemas Embarcados (Projetos de IoT, ESP32 com TCC publicado na COBRICS e Linux com Buildroot)");
  if (detectedTechs.includes("Microsoft Azure & Firebase")) strengths.push("Microsoft Azure & Firebase (Telemetria em VM Azure e sincronização em tempo real com Firebase)");
  if (detectedTechs.includes("Inglês Avançado / Fluente")) strengths.push("Inglês Avançado (Comunicação técnica e fluência para equipes globais ou leitura profunda)");

  // Quick Wins (Base conceitual forte pelo MBA USP/Esalq + projetos)
  if (detectedTechs.includes("Clean Architecture")) quickWins.push("Clean Architecture (Módulo do MBA USP/Esalq e aplicação prática)");
  if (detectedTechs.includes("Domain-Driven Design (DDD)")) quickWins.push("Domain-Driven Design (Domínio de bounded contexts e entidades ricas pelo MBA)");
  if (detectedTechs.includes("Mensageria (RabbitMQ / Kafka)")) quickWins.push("Mensageria & Filas (Fundamentos de pub/sub, mensageria e resiliência no MBA)");
  if (detectedTechs.includes("TDD / Testes Automatizados")) quickWins.push("TDD e Testes Automatizados (Prática com Jest e pirâmide de testes)");
  if (detectedTechs.includes("Microsserviços")) quickWins.push("Microsserviços e Sistemas Distribuídos (Padrões de resiliência e circuit breaker)");
  if (detectedTechs.includes("CI/CD")) quickWins.push("CI/CD & Automação (Familiaridade com GitHub Actions e pipelines)");
  if (detectedTechs.includes("NoSQL / MongoDB / Redis")) quickWins.push("Bancos NoSQL / Cache (Fundamentos de caching e persistência alternativa)");
  if (detectedTechs.includes("GraphQL")) quickWins.push("GraphQL (Conceitos de schema-first e resolução de queries)");

  // Gaps Críticos (Exigências mandatórias fora do escopo Pleno atual)
  const isExclusiveSenior =
    level === "senior" &&
    !/pleno ou s[êe]nior|pleno\/s[êe]nior|mid-senior|pleno/i.test(lower) &&
    (lower.includes("5+ anos") ||
      lower.includes("6+ anos") ||
      lower.includes("8+ anos") ||
      lower.includes("liderança técnica") ||
      lower.includes("gestão de pessoas"));

  if (isExclusiveSenior) {
    criticalGaps.push("Tempo de experiência formal exigido (vaga sênior/lead exigindo 5+ anos exclusivos)");
  }

  if (
    detectedTechs.includes("Java / Spring Boot") &&
    !detectedTechs.includes("Node.js") &&
    !detectedTechs.includes("Python") &&
    !detectedTechs.includes("TypeScript")
  ) {
    criticalGaps.push("Foco primário mandatório em ecossistema Java/Spring Boot (fora da stack core)");
  }

  if (
    detectedTechs.includes("C# / .NET") &&
    !detectedTechs.includes("Node.js") &&
    !detectedTechs.includes("Python") &&
    !detectedTechs.includes("TypeScript")
  ) {
    criticalGaps.push("Foco primário mandatório em ecossistema .NET / C#");
  }

  if (detectedTechs.includes("Kubernetes") && lower.includes("especialista em kubernetes")) {
    criticalGaps.push("Administração avançada de clusters Kubernetes em produção");
  }

  // 4. Cálculo do Match Score (0 a 100)
  let score = 50; // base

  score += Math.min(strengths.length * 8, 35);
  score += Math.min(quickWins.length * 4, 15);
  score -= criticalGaps.length * 25;

  if (
    (detectedTechs.includes("TypeScript") && detectedTechs.includes("Node.js")) ||
    (detectedTechs.includes("IA Generativa & LLMs") && detectedTechs.includes("Python")) ||
    (detectedTechs.includes("Claude & Anthropic") && detectedTechs.includes("N8N & Automação de Workflows"))
  ) {
    score += 10;
  }

  score = Math.max(10, Math.min(98, score));

  // 5. Veredito Pragmático
  let verdict: "Sim" | "Com ressalvas" | "Não" = "Sim";
  let verdictReason = "";

  if (criticalGaps.length >= 2 || score < 45) {
    verdict = "Não";
    verdictReason = `A vaga possui desvios críticos da sua stack atual (${criticalGaps.join("; ")}). O esforço de adaptação é desproporcional para o nível Pleno.`;
  } else if (criticalGaps.length === 1 || score < 70) {
    verdict = "Com ressalvas";
    verdictReason = `Boa oportunidade de aplicação com posicionamento estratégico. Destaque sua atuação prática em produção (CONTELE-OS e integrações) e a formação teórica do MBA USP/Esalq para fechar os gaps pontuais (${quickWins.slice(0, 2).join(", ") || "conceituais"}).`;
  } else {
    verdict = "Sim";
    verdictReason = `Excelente aderência para o nível Pleno! Seu domínio em engenharia de software em produção (CONTELE-OS e integrações de microsserviços) e a base do MBA USP/Esalq atendem aos requisitos essenciais da vaga.`;
  }

  return {
    level,
    matchScore: score,
    verdict,
    verdictReason,
    strengths,
    quickWins,
    criticalGaps,
    keyTechnologies: detectedTechs,
  };
}

/**
 * Monta o Pitch de Conexão de 3 parágrafos para abordagem no LinkedIn sem truncamento de termos compostos.
 */
export function buildConnectionPitch(
  company: string,
  role: string,
  strengths: string[],
  quickWins: string[]
): string {
  const topTechs = strengths
    .slice(0, 3)
    .map((s) => s.split("(")[0].trim())
    .filter(Boolean)
    .join(", ") || "TypeScript e Node.js";

  const mbaHighlights = quickWins
    .slice(0, 2)
    .map((q) => q.split("(")[0].trim())
    .filter(Boolean)
    .join(" e ") || "Clean Architecture e TDD";

  const isGenericComp = !company || company.trim().toLowerCase() === "empresa";
  const greeting = isGenericComp
    ? `Olá! Vi a oportunidade para ${role} e me identifiquei muito com os desafios técnicos da posição.`
    : `Olá! Acompanho a evolução da ${company} e me identifiquei muito com a oportunidade para ${role}.`;

  const companyCallToAction = isGenericComp
    ? `Acredito que posso somar rapidamente aos desafios de engenharia do time.`
    : `Acredito que posso somar rapidamente aos desafios de engenharia do time da ${company}.`;

  const hasAi = strengths.some((s) => /ia|llm|agente|rag|claude/i.test(s));
  const projectMention = hasAi
    ? `Em projetos corporativos como o CONTELE-OS e em soluções de automação com agentes e IA generativa`
    : `Em sistemas corporativos de alta criticidade como o ecossistema CONTELE-OS e integrações de microsserviços`;

  return `${greeting} Sou Engenheiro da Computação, pós-graduando no MBA em Engenharia de Software pela USP/Esalq, e venho atuando no desenvolvimento de soluções backend e fullstack robustas.

No meu dia a dia técnico, tenho foco prático em ${topTechs}, além de arquitetura limpa, modelagem relacional em SQL e microsserviços. ${projectMention}, apliquei conceitos avançados de ${mbaHighlights} para entregar código resiliente, testável e de alto desempenho.

${companyCallToAction} Fico à disposição para uma conversa rápida sobre como posso agregar valor ao projeto. Um abraço!`;
}

/**
 * Estrutura representativa de um projeto prático.
 */
export interface PracticalProjectItem {
  id: string;
  title: string;
  period: string;
  roleOrContext: string;
  stack: string[];
  bullets: string[];
  repoUrl?: string;
  relevanceScore: number;
}

/**
 * Catálogo completo de projetos reais de Luiz Ricardo Favaro.
 */
export const MASTER_PROJECTS_CATALOG: PracticalProjectItem[] = [
  {
    id: "benito",
    title: "Benito — Assistente Autônomo & Engenharia de IA",
    period: "2026",
    roleOrContext: "Criador & Engenheiro Principal",
    stack: ["Node.js 22+", "TypeScript 5.8+", "Vercel AI SDK", "LanceDB", "EmbeddingGemma-2", "Ollama", "Zod", "Jest"],
    repoUrl: "https://github.com/ri-favaro/BenitoAgentePessoal",
    bullets: [
      "Arquitetura modular de agentes autônomos com execução de ferramentas (tool calling) e streaming em tempo real.",
      "Motor local de RAG vetorial com LanceDB e EmbeddingGemma-2 (768d) otimizado (~270MB RAM) com indexação incremental via SHA-256.",
      "Sandbox estrito de segurança no sistema de arquivos e execução de comandos de terminal com whitelist de processos.",
      "Cobertura completa de testes automatizados com Jest (14 suítes) validando regras de negócio, integrações REST/CLI e persistência.",
    ],
    relevanceScore: 9,
  },
  {
    id: "cobrics-tcc",
    title: "Sistema Interativo com Hardware Embarcado & Cloud — Artigo Publicado no COBRICS 2024",
    period: "2024",
    roleOrContext: "Trabalho de Conclusão de Curso (Nota 10) & Artigo Publicado no Congresso COBRICS",
    stack: ["C/C++", "ESP32", "RFID", "Firebase", "Android", "Prototipagem Eletrônica"],
    bullets: [
      "Arquitetura ponta a ponta integrando hardware embarcado (ESP32 + RFID), sincronização em nuvem em tempo real (Firebase) e aplicativo móvel Android.",
      "Validado em campo com crianças (4 a 8 anos) e pedagogos; obteve nota máxima (10) na banca de Engenharia da Computação e publicação científica nos anais da COBRICS 2024.",
    ],
    relevanceScore: 8,
  },
  {
    id: "rmda-azure",
    title: "RMDA — Telemetria Distribuída e Processamento em Nuvem na Azure",
    period: "2023",
    roleOrContext: "Projeto IoT & Cloud Computing",
    stack: ["Microsoft Azure (VM)", "LoRaWAN", "The Things Network (TTN)", "Python/Node.js", "Dashboard Gráfico"],
    repoUrl: "https://github.com/ri-favaro/Projeto-IOT-23",
    bullets: [
      "Desenvolvimento de telemetria distribuída com transmissão de dados de longo alcance via LoRaWAN/TTN para servidor e processamento em VM Microsoft Azure com dashboard gráfico.",
    ],
    relevanceScore: 7,
  },
  {
    id: "linux-buildroot",
    title: "Sistema Operacional Linux Customizado com Buildroot para Raspberry Pi 4",
    period: "2023",
    roleOrContext: "Sistemas Embarcados & Otimização de Kernel",
    stack: ["Buildroot", "Raspberry Pi 4", "Linux Embarcado", "Shell Script"],
    repoUrl: "https://github.com/ri-favaro/Primeiro-sistema-operacional-proprio",
    bullets: [
      "Criação e compilação de SO Linux customizado e enxuto do zero utilizando Buildroot e Shell Script para hardware real Raspberry Pi 4.",
    ],
    relevanceScore: 5,
  },
  {
    id: "widrow-hoff",
    title: "Algoritmo Widrow-Hoff — Machine Learning Supervisionado Interativo",
    period: "2023",
    roleOrContext: "Machine Learning Clássico",
    stack: ["JavaScript", "HTML5", "CSS3", "Machine Learning"],
    repoUrl: "https://github.com/ri-favaro/Algoritmo-baseado-no-m-todo-WidrowHoff---HTML",
    bullets: [
      "Implementação interativa do algoritmo supervisionado Widrow-Hoff (LMS) com visualização matemática da convergência de pesos em tempo real no navegador.",
    ],
    relevanceScore: 4,
  },
];

/**
 * Seleciona dinamicamente os 2 a 3 projetos práticos mais aderentes à vaga para manter o currículo em até 2 páginas.
 */
export function selectTailoredProjects(keyTechnologies: string[] = []): PracticalProjectItem[] {
  const techsLower = keyTechnologies.map((t) => t.toLowerCase());

  const isAiOrAgents = techsLower.some((t) =>
    t.includes("ia") ||
    t.includes("llm") ||
    t.includes("agente") ||
    t.includes("rag") ||
    t.includes("genai") ||
    t.includes("prompt") ||
    t.includes("claude") ||
    t.includes("anthropic")
  );
  const isEmbeddedOrLinux = techsLower.some((t) =>
    t.includes("c/c++") || t.includes("embarcados") || t.includes("linux") || t.includes("iot")
  );
  const isCloudOrAzure = techsLower.some((t) =>
    t.includes("azure") || t.includes("cloud") || t.includes("telemetria")
  );

  if (isAiOrAgents) {
    if (isCloudOrAzure) {
      return [
        MASTER_PROJECTS_CATALOG.find((p) => p.id === "benito")!,
        MASTER_PROJECTS_CATALOG.find((p) => p.id === "rmda-azure")!,
      ].filter(Boolean);
    }
    return [
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "benito")!,
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "cobrics-tcc")!,
    ].filter(Boolean);
  }

  if (isEmbeddedOrLinux) {
    return [
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "cobrics-tcc")!,
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "linux-buildroot")!,
    ].filter(Boolean);
  }

  if (isCloudOrAzure) {
    return [
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "rmda-azure")!,
      MASTER_PROJECTS_CATALOG.find((p) => p.id === "cobrics-tcc")!,
    ].filter(Boolean);
  }

  // Padrão para Backend / Fullstack / DevOps / Software em geral (Prioridade para infraestrutura e engenharia)
  return [
    MASTER_PROJECTS_CATALOG.find((p) => p.id === "rmda-azure")!,
    MASTER_PROJECTS_CATALOG.find((p) => p.id === "cobrics-tcc")!,
  ].filter(Boolean);
}

/**
 * Gera o texto do Resumo Profissional, com opção de refinamento assistido por LLM.
 */
export async function buildProfessionalSummary(
  role: string,
  company: string,
  keyTechnologies: string[] = []
): Promise<string> {
  const defaultSummary =
    `Engenheiro da Computação (UNISANTA) e pós-graduando no MBA em Engenharia de Software (USP/ESALQ), com atuação prática e comprovada na construção de APIs REST escaláveis, integrações críticas de sistemas, microsserviços e soluções produtivas com IA Generativa (Claude e modelos locais). Sólida proficiência em TypeScript, Node.js (ESM), PostgreSQL, Docker e Next.js, combinada com rigor arquitetural em Clean Architecture, Domain-Driven Design (DDD) e TDD. Focado em código limpo, testável, de alta manutenibilidade e entrega ágil orientada a valor de negócio.`;

  try {
    const model = getLanguageModel();
    const prompt = `Você é o assistente de carreira pessoal de Luiz Ricardo Favaro.
Gere um parágrafo único de Resumo Profissional (4 a 6 linhas) calibrado especificamente para o nível PLENO para a vaga de "${role}" na empresa "${company}".
Tecnologias-chave da vaga: ${keyTechnologies.join(", ") || "TypeScript, Node.js, SQL, Docker, APIs REST"}.

FATOS REAIS QUE VOCÊ DEVE USAR (NUNCA INVENTE OUTROS):
- Nome: Luiz Ricardo Favaro
- Graduação: Engenheiro da Computação (Universidade Santa Cecília - UNISANTA, TCC nota 10 publicado na COBRICS 2024).
- Pós-graduação: MBA em Engenharia de Software (USP/ESALQ) em andamento.
- Atuação Atual: Contele (Desenvolvedor de Integrações - Node.js, TypeScript, N8N, fluxo de postagem Correios, LLMs/Claude e CONTELE-OS com Next.js/PostgreSQL).
- Projetos Relevantes: CONTELE-OS (Next.js/PostgreSQL), Integrações Correios/N8N, e soluções em produção de automação e engenharia de software.
- Idiomas: Inglês Avançado.

DIRETRIZES ESTREITAS:
1. Posicione com tom de Engenheiro de Software Pleno experiente em produção. NUNCA use "em início de carreira" nem "buscando aprender".
2. Não invente nenhuma tecnologia ou experiência que não esteja nos fatos acima.
3. Responda APENAS o parágrafo em Markdown sem títulos ou explicações.`;

    const { text } = await generateText({
      model,
      prompt,
      maxTokens: 250,
      temperature: 0.3,
    });

    const trimmed = text.trim();
    if (trimmed && trimmed.length > 80 && !trimmed.toLowerCase().includes("início de carreira")) {
      return trimmed;
    }
  } catch {
    // Fallback gracioso para template determinístico caso a LLM esteja offline ou em testes
  }

  return defaultSummary;
}

/**
 * Gera o conteúdo Markdown do currículo limpo (pronto para PDF/ATS).
 */
export async function buildTailoredResumeMarkdown(
  company: string,
  role: string,
  strengths: string[],
  quickWins: string[],
  keyTechnologies: string[] = []
): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const summary = await buildProfessionalSummary(role, company, keyTechnologies);
  const selectedProjects = selectTailoredProjects(keyTechnologies);

  const skillsList = [
    "- **Linguagens:** TypeScript, JavaScript (ES2023+ / Node.js), Python, SQL (PostgreSQL, MySQL), Go (Golang), C/C++.",
    "- **Backend & Integrações:** APIs RESTful (design, consumo, geração de PDFs e webhooks), Node.js (v20+ / v22+), Express, Zod, N8N (automação de workflows).",
    "- **IA & Engenharia Cognitiva:** Integração com APIs de LLMs (Anthropic Claude, OpenAI), Vercel AI SDK, Ollama, RAG com LanceDB (vetorial) e EmbeddingGemma-2.",
    "- **Arquitetura & Engenharia:** Clean Architecture, Domain-Driven Design (DDD), Test-Driven Development (TDD), Microsserviços e Mensageria.",
    "- **Frontend:** Next.js (App Router, Server Components), React, Tailwind CSS.",
    "- **DevOps & Ferramentas:** Docker, Docker Compose, Git, GitHub Actions, Microsoft Azure (VMs), Linux.",
  ];

  const projectsMarkdown = selectedProjects
    .map((p) => {
      const repoLine = p.repoUrl ? ` | [Repositório GitHub](${p.repoUrl})` : "";
      return `#### **${p.title}** | *${p.roleOrContext}* (${p.period})${repoLine}\n` +
        `- **Stack:** ${p.stack.join(", ")}\n` +
        p.bullets.map((b) => `- ${b}`).join("\n");
    })
    .join("\n\n");

  return [
    `# Luiz Ricardo Favaro - ${role}`,
    `**Localização:** Guarujá, São Paulo | **Contato:** ricardofavaro6@gmail.com | (13) 98174-8698`,
    `**Perfis:** [LinkedIn](https://www.linkedin.com/in/ri-favaro/) | [GitHub](https://github.com/ri-favaro)`,
    ``,
    `---`,
    ``,
    `## Resumo Profissional`,
    ``,
    summary,
    ``,
    `---`,
    ``,
    `## Experiência Profissional`,
    ``,
    `#### **Contele** | *Desenvolvedor de Integrações · Foco em IA e Automações*`,
    `*Santos, SP | abr/2026 – atual*`,
    `- **Automação Logística & Correios Ponta a Ponta:** Arquitetura e desenvolvimento de integração com as APIs REST dos Correios (cotação comparativa Correios vs transportadoras, pré-postagem automática, emissão de etiquetas em PDF e geração de comprovantes detalhados de logística reversa na troca de equipamentos), eliminando erros manuais.`,
    `- **Dashboard de Rastreamento em Tempo Real:** Desenvolvimento de interface visual integrada à API Rastro dos Correios, com identificação automática de atrasos operacionais, filtros dinâmicos de status (Em trânsito, Aguardando retirada, Entregue, Atrasado) e busca inteligente por destinatário ou código de envio.`,
    `- **Integrações de Negócio & Workflows N8N:** Construção de pipelines corporativos de automação utilizando Node.js, TypeScript e N8N, orquestrando fluxos com Pipedrive (CRM), Asana (sincronização de tarefas e anexos de marketing/projetos) e grupos corporativos de WhatsApp via webhooks e mensageria assíncrona.`,
    `- **Engenharia de IA & LLMs em Produção:** Implementação de fluxos com Claude (Anthropic) para triagem inteligente de dados operacionais, abertura assistida de demandas e automação da auditoria de predição de churn para equipes de Customer Success (CS).`,
    `- **Desenvolvimento Fullstack no CONTELE-OS:** Desenvolvimento de módulos críticos com Next.js (App Router), React, TypeScript e Supabase (PostgreSQL), modelagem relacional com views otimizadas, migrações versionadas em SQL, validação estrita de runtime com Zod e testes unitários com Jest sob metodologia ágil Kanban.`,
    ``,
    `#### **O Especialista** | *Suporte de TI & Infraestrutura*`,
    `*Guarujá, SP | jun/2024 – dez/2024 (6 meses)*`,
    `- Prestação de suporte técnico nível 1 e 2 (presencial e remoto) atendendo simultaneamente de 4 a 5 empresas clientes corporativas.`,
    `- Diagnóstico avançado de incidentes críticos de TI, configuração de redes locais (TCP/IP, roteamento, firewalls), infraestrutura e manutenção de hardware com foco em SLA e alta disponibilidade.`,
    `- Atuação direta com stakeholders e resolução rápida de problemas sob pressão operacional.`,
    ``,
    `---`,
    ``,
    `## Competências Técnicas`,
    ``,
    skillsList.join("\n"),
    ``,
    `---`,
    ``,
    `## Formação Acadêmica`,
    ``,
    `- **MBA em Engenharia de Software** | *Universidade de São Paulo (USP / ESALQ)* — Em andamento`,
    `  - Módulos avançados: Clean Architecture, DDD, Mensageria Assíncrona (RabbitMQ/Kafka), Microsserviços e TDD.`,
    `- **Bacharelado em Engenharia da Computação** | *Universidade Santa Cecília (UNISANTA)* — Concluído em 2024`,
    `  - Autor de artigo publicado no congresso científico COBRICS 2024; nota máxima (10) no TCC de jogos lúdicos com ESP32 e Firebase.`,
    ``,
    `---`,
    ``,
    `## Projetos de Engenharia Relevantes`,
    ``,
    projectsMarkdown,
    ``,
    `---`,
    ``,
    `## Idiomas`,
    ``,
    `- **Português:** Nativo`,
    `- **Inglês:** Avançado`,
    `- **Espanhol:** Intermediário`,
    ``,
  ].join("\n");
}
function _unusedOldResumeEnd(company = "", dateStr = "", summary = "", skillsList: string[] = [], projectsMarkdown = "") { return `# unused
**Empresa Alvo:** ${company} | **Data da Versão:** ${dateStr}
**Localização:** Guarujá, São Paulo | **Contato:** ricardofavaro6@gmail.com | (13) 98174-8698
**Perfis:** [LinkedIn](https://www.linkedin.com/in/ri-favaro/) | [GitHub](https://github.com/ri-favaro)

---

## 👤 Resumo Profissional

${summary}

---

## 🛠️ Competências Técnicas

${skillsList.join("\n")}

---

## 💼 Experiência Profissional

#### **Contele** | *Desenvolvedor de Integrações · Foco em IA e Automações*
*Santos, SP | abr/2026 – atual*
- Desenvolvimento de integrações críticas e automações de processos de negócio com **Node.js**, **TypeScript** e **N8N**.
- Automação completa ponta a ponta do fluxo de postagem dos **Correios** via APIs REST externas (pré-postagem, geração automatizada de etiquetas em PDF e dashboard de rastreamento).
- Aplicação prática de **LLMs (Anthropic Claude)** em fluxos produtivos de automação inteligente e triagem de dados.
- Desenvolvimento fullstack na plataforma **CONTELE-OS** utilizando **Next.js**, **React**, **TypeScript** e **Supabase (PostgreSQL)** com migrações versionadas e validação estrita via **Zod**.
- Implementação de testes unitários com **Jest** e atuação em equipe ágil com metodologia **Kanban**.

#### **O Especialista** | *Suporte de TI & Infraestrutura*
*Guarujá, SP | jun/2024 – dez/2024 (6 meses)*
- Prestação de suporte técnico nível 1 e 2 presencial e remoto para 4 a 5 empresas clientes simultâneas.
- Diagnóstico e reparo de hardware, configuração de redes locais e resolução de incidentes críticos de TI com foco em agilidade e SLA.

---

## 🚀 Projetos de Engenharia Relevantes

${projectsMarkdown}

---

## 🎓 Formação Acadêmica

- **MBA em Engenharia de Software** | *Universidade de São Paulo (USP / ESALQ)* — Em andamento
  - Módulos avançados: Clean Architecture, DDD, Mensageria Assíncrona (RabbitMQ/Kafka), Microsserviços e TDD.
- **Bacharelado em Engenharia da Computação** | *Universidade Santa Cecília (UNISANTA)* — Concluído em 2024
  - Autor de artigo publicado no congresso científico COBRICS 2024; nota máxima (10) no TCC de jogos lúdicos com ESP32 e Firebase.

---

## 🌐 Idiomas

- **Português:** Nativo
- **Inglês:** Avançado
- **Espanhol:** Intermediário
`;
}

/**
 * Gera o arquivo desacoplado de Pitch de Conexão + Guia de Revisão e Otimização ATS.
 */
export function buildTailoredPitchAndAtsGuide(
  company: string,
  role: string,
  pitch: string,
  evalResult: {
    matchScore: number;
    verdict: string;
    strengths: string[];
    quickWins: string[];
    criticalGaps: string[];
    keyTechnologies: string[];
  },
  cvFileName: string
): string {
  const dateStr = new Date().toISOString().slice(0, 10);

  const hasAi = evalResult.keyTechnologies.some((t) => /ia|llm|agente|rag|claude/i.test(t));
  const technicalHighlight = hasAi
    ? `- **Destaque em Engenharia de IA & LLMs:** Evidencie o uso prático de LLMs/Claude em fluxos corporativos na Contele e a arquitetura de RAG vetorial/agentes autônomos (Vercel AI SDK, Tool Calling).`
    : `- **Destaque de Arquitetura & Backend:** Destaque o ecossistema CONTELE-OS (Next.js, Supabase/PostgreSQL, migrations versionadas, Zod) e as práticas de Clean Architecture / TDD aplicadas no MBA USP/Esalq.`;

  return `# 🎯 Pitch de Conexão & Guia de Otimização ATS
**Cargo Alvo:** ${role} | **Empresa:** ${company}
**Data da Versão:** ${dateStr} | **Match Score:** ${evalResult.matchScore}% (${evalResult.verdict.toUpperCase()})
**Arquivo de Currículo Gerado:** \`${cvFileName}\`

---

## 💬 Pitch de Abordagem Direta (LinkedIn / Tech Recruiter / Tech Lead)

> *Copie e cole a mensagem abaixo para abordagem personalizada via mensagem ou nota de conexão no LinkedIn:*

${pitch}

---

## 🔍 Guia de Revisão & Otimização ATS (Antes de Enviar)

### 📌 1. Palavras-Chave da Vaga Mapeadas & Presentes no CV
${evalResult.keyTechnologies.map((t) => `- [x] **${t}:** presente e evidenciada nas competências e experiências`).join("\n") || "- [x] Stacks essenciais (TypeScript, Node.js, SQL, Docker)"}

### 💡 2. Recomendações para Formulários ATS (Gupy, Greenhouse, Lever)
- **Título de Entrada:** Use exatamente \`${role}\` como seu título principal.
- **Carta de Apresentação / Campo 'Sobre Você':** Utilize os 2 primeiros parágrafos do Pitch de Conexão acima.
- **Arquivo para Upload:** Exporte o arquivo limpo \`${cvFileName}\` em PDF antes do upload.

### 🎯 3. Pontos de Atenção para a Entrevista Técnica
- **Destaque de Engenharia na Contele:** Mencione a integração com Correios (geração de PDF, APIs REST e dashboard de rastreamento) e as automações corporativas com N8N/Claude.
${technicalHighlight}
- **Fechamento de Quick Wins do MBA:** ${evalResult.quickWins.slice(0, 2).join("; ") || "Evidencie Clean Architecture e testes unitários."}
`;
}

/**
 * Formata visualmente o funil de candidaturas em colunas Kanban para exibição no CLI e Telegram.
 */
export function formatJobPipelineKanban(jobs: AnalyzedJobRecord[]): string {
  if (jobs.length === 0) {
    return "Nenhuma vaga analisada no funil ainda.";
  }

  const columns: Record<JobApplicationStatus, AnalyzedJobRecord[]> = {
    analisada: [],
    cv_gerado: [],
    aplicada: [],
    entrevista: [],
    rejeitada: [],
    oferta: [],
  };

  for (const j of jobs) {
    const st = j.status || (j.cvPath ? "cv_gerado" : "analisada");
    if (columns[st]) {
      columns[st].push(j);
    } else {
      columns.analisada.push(j);
    }
  }

  let out = `=== 📊 FUNIL DE CANDIDATURAS (${jobs.length} VAGAS) ===\n\n`;

  out += `📥 [1. ANALISADAS] (${columns.analisada.length})\n`;
  if (columns.analisada.length === 0) {
    out += `   (Nenhuma vaga nesta etapa)\n`;
  } else {
    for (const j of columns.analisada) {
      out += `   • ${j.company} - ${j.role} (${j.matchScore}% | ID: ${j.id})\n`;
    }
  }
  out += "\n";

  out += `📄 [2. CV PRONTO & PITCH GERADO] (${columns.cv_gerado.length})\n`;
  if (columns.cv_gerado.length === 0) {
    out += `   (Nenhuma vaga nesta etapa)\n`;
  } else {
    for (const j of columns.cv_gerado) {
      out += `   • ${j.company} - ${j.role} (${j.matchScore}% | ID: ${j.id})\n`;
    }
  }
  out += "\n";

  out += `📤 [3. APLICADAS / EM ANÁLISE] (${columns.aplicada.length})\n`;
  if (columns.aplicada.length === 0) {
    out += `   (Nenhuma vaga nesta etapa)\n`;
  } else {
    for (const j of columns.aplicada) {
      out += `   • ${j.company} - ${j.role} (${j.matchScore}% | ID: ${j.id})\n`;
    }
  }
  out += "\n";

  out += `💬 [4. EM ENTREVISTA / DESAFIO] (${columns.entrevista.length})\n`;
  if (columns.entrevista.length === 0) {
    out += `   (Nenhuma vaga nesta etapa)\n`;
  } else {
    for (const j of columns.entrevista) {
      out += `   • ${j.company} - ${j.role} [${j.matchScore}%] ${j.notes ? `(${j.notes})` : ""}\n`;
    }
  }
  out += "\n";

  const totalFinalizadas = columns.oferta.length + columns.rejeitada.length;
  out += `🏁 [5. FINALIZADAS] (${totalFinalizadas})\n`;
  if (totalFinalizadas === 0) {
    out += `   (Nenhuma vaga finalizada)\n`;
  } else {
    for (const j of columns.oferta) {
      out += `   🎉 OFERTA: ${j.company} - ${j.role}\n`;
    }
    for (const j of columns.rejeitada) {
      out += `   🔴 REJEITADA: ${j.company} - ${j.role}\n`;
    }
  }

  return out;
}

/**
 * Constrói dinamicamente a Matriz de Estudos cruzando gaps com materiais do MBA.
 */
export function buildDynamicStudyMatrix(
  jobs: AnalyzedJobRecord[],
  topSkills: Array<{ skill: string; count: number; percentage: number }>,
  topCriticalGaps: Array<{ gap: string; count: number }>,
  topQuickWins: Array<{ gap: string; count: number }>
): {
  studyMatrix: CareerMarketReport["studyMatrix"];
  weeklyStudyFocus: string;
} {
  const matrix: CareerMarketReport["studyMatrix"] = [];

  const allGapsText = [
    ...topCriticalGaps.map((g) => g.gap),
    ...topQuickWins.map((q) => q.gap),
    ...topSkills.slice(0, 5).map((s) => s.skill),
  ].join(" ").toLowerCase();

  // 1. Mensageria & Filas
  if (allGapsText.includes("mensageria") || allGapsText.includes("kafka") || allGapsText.includes("rabbitmq")) {
    matrix.push({
      area: "Mensageria & Filas Assíncronas (RabbitMQ / Kafka)",
      action: "Praticar envio e consumo assíncrono com DLQ, retries e ack/nack no Node.js",
      localResource: "memory/topics/arquitetura-mensageria.md & materiais do MBA",
      effort: "Médio",
      marketImpact: "Alto",
      priority: "Alta",
    });
  }

  // 2. Clean Architecture & DDD
  if (allGapsText.includes("clean architecture") || allGapsText.includes("ddd") || allGapsText.includes("arquitetura")) {
    matrix.push({
      area: "Clean Architecture & DDD Prático",
      action: "Revisar use cases e interfaces de domínio no backend",
      localResource: "G:\\MBA-EngSoftware (Resumo_Avaliacao_Clean_Architecture_II.pdf e resumo-ddd.pdf)",
      effort: "Baixo",
      marketImpact: "Alto",
      priority: "Alta",
    });
  }

  // 3. Cloud & Docker
  if (allGapsText.includes("cloud") || allGapsText.includes("aws") || allGapsText.includes("docker") || allGapsText.includes("azure")) {
    matrix.push({
      area: "Cloud & Conteinerização (Docker / Azure / AWS)",
      action: "Configurar deploy de container com Docker Compose e rotinas de CI/CD",
      localResource: "Projeto RMDA Azure (Projeto-IOT-23) & Dockerfiles multi-stage",
      effort: "Médio",
      marketImpact: "Muito Alto",
      priority: "Alta",
    });
  }

  // 4. Testes Automatizados & TDD
  if (allGapsText.includes("test") || allGapsText.includes("tdd") || allGapsText.includes("jest")) {
    matrix.push({
      area: "Testes Automatizados (TDD & Jest)",
      action: "Expandir testes unitários e de integração no backend com mocks desacoplados",
      localResource: "Suítes Jest do CONTELE-OS e testes do Benito",
      effort: "Baixo",
      marketImpact: "Alto",
      priority: "Alta",
    });
  }

  // Se a lista estiver vazia por falta de gaps críticos específicos, fornece a base recomendada para Pleno
  if (matrix.length === 0) {
    matrix.push(
      {
        area: "Mensageria & Filas (RabbitMQ / Kafka)",
        action: "Praticar envio e consumo assíncrono de eventos com DLQ no Node.js",
        localResource: "memory/topics/arquitetura-mensageria.md",
        effort: "Médio",
        marketImpact: "Alto",
        priority: "Alta",
      },
      {
        area: "Clean Architecture & DDD Prático",
        action: "Modularizar use cases e entidades desacopladas em microsserviço modelo",
        localResource: "G:\\MBA-EngSoftware",
        effort: "Baixo",
        marketImpact: "Alto",
        priority: "Alta",
      }
    );
  }

  const weeklyStudyFocus = matrix[0]?.area || "Arquitetura e Microsserviços";

  return { studyMatrix: matrix, weeklyStudyFocus };
}

/**
 * Cria as ferramentas Vercel AI SDK do Copiloto de Carreira.
 */
export function createCareerTools(
  vaultPath: string,
  allowedPaths: string[] = [vaultPath]
) {
  return {
    analyze_job_posting: tool({
      description:
        "Analisa detalhadamente uma vaga de emprego (recebendo a URL da vaga ou o texto bruto colado) e calcula a aderência técnica calibrada especificamente para o nível Pleno (Mid-level). Identifica pontos fortes, quick wins (baseados no MBA USP/Esalq), gaps críticos, veredito pragmático ('Sim', 'Com ressalvas', 'Não') e registra a análise de forma persistente em Carreira/vagas-analisadas.json no Obsidian.",
      parameters: z.object({
        url: z
          .string()
          .optional()
          .describe("URL da vaga na web (LinkedIn, Gupy, Greenhouse, Lever, etc.) para leitura profunda."),
        jobText: z
          .string()
          .optional()
          .describe("Texto bruto ou descrição completa da vaga caso o usuário tenha colado o anúncio."),
        company: z
          .string()
          .optional()
          .describe("Nome da empresa que abriu a vaga (se já conhecido)."),
        role: z
          .string()
          .optional()
          .describe("Título do cargo anunciado (ex: 'Desenvolvedor Backend Pleno')."),
      }),
      execute: async ({ url, jobText, company = "Empresa", role = "Desenvolvedor Pleno" }) => {
        try {
          if (!url && !jobText) {
            return {
              success: false,
              error: "Informe a URL da vaga ou cole o texto/descrição para que a análise de aderência possa ser executada.",
            };
          }

          await ensureCareerProfileExists(vaultPath, allowedPaths);

          let rawContent = jobText || "";
          if (url) {
            try {
              const fetched = await fetchJobPostingContent(url);
              rawContent = rawContent ? `${rawContent}\n\n${fetched}` : fetched;
            } catch (fetchErr: any) {
              if (!jobText) {
                return {
                  success: false,
                  error: `Não foi possível acessar a URL da vaga (${fetchErr?.message || fetchErr}). Por favor, cole o texto da vaga no chat.`,
                };
              }
            }
          }

          let finalCompany = company;
          let finalRole = role;
          if (finalCompany === "Empresa" || finalRole === "Desenvolvedor Pleno" || !finalCompany || !finalRole) {
            const extractedMeta = extractJobMetadata(rawContent, url);
            if (extractedMeta.company && (finalCompany === "Empresa" || !finalCompany)) {
              finalCompany = extractedMeta.company;
            }
            if (extractedMeta.role && (finalRole === "Desenvolvedor Pleno" || !finalRole)) {
              finalRole = extractedMeta.role;
            }
          }

          const evalResult = evaluateJobMatch(rawContent, finalCompany, finalRole);
          const dateStr = new Date().toISOString().slice(0, 10);
          const slugCompany = finalCompany.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const slugRole = finalRole.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const recordId = `${dateStr}-${slugCompany || "empresa"}-${slugRole || "pleno"}`;

          const record: AnalyzedJobRecord = {
            id: recordId,
            date: dateStr,
            company: finalCompany,
            role: finalRole,
            url,
            level: evalResult.level,
            matchScore: evalResult.matchScore,
            verdict: evalResult.verdict,
            verdictReason: evalResult.verdictReason,
            strengths: evalResult.strengths,
            quickWins: evalResult.quickWins,
            criticalGaps: evalResult.criticalGaps,
            keyTechnologies: evalResult.keyTechnologies,
            status: "analisada",
            statusUpdatedAt: dateStr,
          };

          await saveAnalyzedJob(vaultPath, record, allowedPaths);

          const summaryMarkdown =
            `### 🎯 Análise de Vaga: ${finalRole} @ ${finalCompany}\n\n` +
            `• **Match Score:** **${evalResult.matchScore}%** (Nível: ${evalResult.level.toUpperCase()})\n` +
            `• **Veredito de Aplicação:** **${evalResult.verdict.toUpperCase()}**\n` +
            `• **Diagnóstico:** ${evalResult.verdictReason}\n\n` +
            `**💪 Pontos Fortes Imediatos:**\n${evalResult.strengths.map((s) => `  - ${s}`).join("\n") || "  - Nenhum alinhamento imediato identificado"}\n\n` +
            `**⚡ Quick Wins (Reforçar no CV/Pitch via MBA USP/Esalq):**\n${evalResult.quickWins.map((q) => `  - ${q}`).join("\n") || "  - Não há gaps conceituais pontuais"}\n\n` +
            `**⚠️ Gaps Críticos:**\n${evalResult.criticalGaps.map((g) => `  - ${g}`).join("\n") || "  - Nenhum gap impeditivo para nível Pleno"}\n\n` +
            `*Registro salvo em \`Carreira/vagas-analisadas.json\` (Status: ANALISADA).*`;

          return {
            success: true,
            jobId: recordId,
            company: finalCompany,
            role: finalRole,
            matchScore: evalResult.matchScore,
            verdict: evalResult.verdict,
            verdictReason: evalResult.verdictReason,
            strengths: evalResult.strengths,
            quickWins: evalResult.quickWins,
            criticalGaps: evalResult.criticalGaps,
            keyTechnologies: evalResult.keyTechnologies,
            summaryMarkdown,
            message: `Vaga ${finalRole} @ ${finalCompany} analisada com sucesso: Veredito ${evalResult.verdict.toUpperCase()} (${evalResult.matchScore}% match). Registro salvo em Carreira/vagas-analisadas.json.`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha na análise de vaga: ${msg}` };
        }
      },
    }),

    generate_tailored_application: tool({
      description:
        "Gera uma versão customizada do Currículo limpo em Markdown (YYYY-MM-Empresa-Cargo-CV.md) e um arquivo desacoplado de Pitch de Conexão + Guia ATS (YYYY-MM-Empresa-Cargo-Pitch.md), adaptando cirurgicamente as experiências e competências reais do perfil master (Contele, Benito, TCC COBRICS, MBA USP/Esalq) sem inventar nada. Salva ambos em Carreira/Vagas/ no cofre do Obsidian e atualiza o status para 'cv_gerado'.",
      parameters: z.object({
        company: z.string().describe("Nome da empresa anunciante."),
        role: z.string().describe("Título do cargo pretendido (ex: 'Desenvolvedor Backend Pleno')."),
        jobId: z
          .string()
          .optional()
          .describe("ID de uma vaga analisada anteriormente em vagas-analisadas.json."),
        focusSkills: z
          .array(z.string())
          .optional()
          .describe("Habilidades ou tecnologias da vaga para dar maior ênfase (ex: ['TypeScript', 'Clean Architecture', 'SQL'])."),
      }),
      execute: async ({ company, role, jobId, focusSkills = [] }) => {
        try {
          await ensureCareerProfileExists(vaultPath, allowedPaths);

          const existingJobs = await loadAnalyzedJobs(vaultPath, allowedPaths);
          const matchedJob = existingJobs.find(
            (j) => j.id === jobId || j.company.toLowerCase() === company.toLowerCase()
          );

          const strengths = matchedJob?.strengths || (focusSkills.length > 0 ? focusSkills : ["TypeScript", "Node.js", "SQL / PostgreSQL", "Docker"]);
          const quickWins = matchedJob?.quickWins || ["Clean Architecture (MBA USP/Esalq)", "TDD com Jest"];
          const keyTechnologies = matchedJob?.keyTechnologies || focusSkills;

          const pitch = buildConnectionPitch(company, role, strengths, quickWins);
          const resumeMarkdown = await buildTailoredResumeMarkdown(company, role, strengths, quickWins, keyTechnologies);

          const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
          const cleanComp = company.replace(/[^a-zA-Z0-9_-]/g, "");
          const cleanRole = role.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30);
          const isGenericComp = !cleanComp || cleanComp.toLowerCase() === "empresa";
          const baseSlug = isGenericComp
            ? `${datePrefix}-Empresa-${cleanRole || "Pleno"}`
            : `${datePrefix}-${cleanComp}-${cleanRole || "Pleno"}`;

          const cvFileName = `${baseSlug}-CV.md`;
          const pitchFileName = `${baseSlug}-Pitch.md`;

          const vagasDir = path.join(vaultPath, "Carreira", "Vagas");
          const targetCvFile = path.join(vagasDir, cvFileName);
          const targetPitchFile = path.join(vagasDir, pitchFileName);

          const checkCv = validateAllowedPath(targetCvFile, allowedPaths);
          const checkPitch = validateAllowedPath(targetPitchFile, allowedPaths);
          if (!checkCv.allowed) return { success: false, error: checkCv.error };
          if (!checkPitch.allowed) return { success: false, error: checkPitch.error };

          await fs.mkdir(vagasDir, { recursive: true });

          const pitchMarkdown = buildTailoredPitchAndAtsGuide(
            company,
            role,
            pitch,
            {
              matchScore: matchedJob?.matchScore || 80,
              verdict: matchedJob?.verdict || "Sim",
              strengths,
              quickWins,
              criticalGaps: matchedJob?.criticalGaps || [],
              keyTechnologies,
            },
            cvFileName
          );

  const cvPdfFileName = `${baseSlug}-CV.pdf`;
  const targetCvPdfFile = path.join(vagasDir, cvPdfFileName);
  await fs.writeFile(targetCvFile, resumeMarkdown, "utf-8");
  await fs.writeFile(targetPitchFile, pitchMarkdown, "utf-8");
  const pdfResult = await renderResumeMarkdownToPdf({
    markdownContent: resumeMarkdown,
    outputPdfPath: targetCvPdfFile,
    roleTitle: role,
  });
  const nowStr = new Date().toISOString().slice(0, 10);
  if (matchedJob) {
    matchedJob.cvPath = targetCvFile;
    matchedJob.cvPdfPath = pdfResult.success ? targetCvPdfFile : undefined;
    matchedJob.pitchPath = targetPitchFile;
    matchedJob.status = "cv_gerado";
    matchedJob.statusUpdatedAt = nowStr;
    await saveAnalyzedJob(vaultPath, matchedJob, allowedPaths);
  }
  return {
    success: true,
    filePath: targetCvFile,
    cvFilePath: targetCvFile,
    cvFileName,
    cvPdfFilePath: targetCvPdfFile,
    cvPdfFileName,
    pdfEngine: pdfResult.engine,
    pitchFilePath: targetPitchFile,
    pitchFileName,
    company,
    role,
    pitch,
    message: `Currículo adaptado (${cvFileName} + ${cvPdfFileName}) e Pitch + Guia ATS (${pitchFileName}) gerados com sucesso! Status da vaga atualizado para 'CV PRONTO'.`,
  };
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  return { success: false, error: `Falha ao gerar currículo e pitch adaptados: ${msg}` };
}
      },
    }),
    export_resume_pdf: tool({
      description:
        "Converte ou atualiza o arquivo PDF (YYYY-MM-Empresa-Cargo-CV.pdf) a partir do arquivo Markdown correspondente (-CV.md) em Carreira/Vagas/, útil após o usuário editar manualmente o currículo no Obsidian.",
      parameters: z.object({
        company: z.string().optional().describe("Nome da empresa para localizar o currículo em Carreira/Vagas/."),
        jobId: z.string().optional().describe("ID da vaga em vagas-analisadas.json."),
        cvMarkdownPath: z.string().optional().describe("Caminho direto do arquivo -CV.md no cofre do Obsidian."),
        roleTitle: z.string().optional().describe("Subtítulo/cargo opcional para exibir no cabeçalho do PDF."),
      }),
      execute: async ({ company, jobId, cvMarkdownPath, roleTitle }) => {
        try {
          await ensureCareerProfileExists(vaultPath, allowedPaths);
          const jobs = await loadAnalyzedJobs(vaultPath, allowedPaths);
          const matchedJob = jobs.find(
            (j) =>
              (jobId && j.id === jobId) ||
              (company && j.company.toLowerCase() === company.toLowerCase())
          );
          let resolvedMdPath = cvMarkdownPath || matchedJob?.cvPath || "";
          if (!resolvedMdPath && company) {
            const vagasDir = path.join(vaultPath, "Carreira", "Vagas");
            const files = await fs.readdir(vagasDir).catch(() => [] as string[]);
            const cleanComp = company.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
            const found = files.find(
              (f) => f.endsWith("-CV.md") && f.toLowerCase().includes(cleanComp)
            );
            if (found) resolvedMdPath = path.join(vagasDir, found);
          }
          if (!resolvedMdPath) {
            return {
              success: false,
              error: "Arquivo -CV.md não localizado. Informe o nome da empresa, jobId ou caminho do arquivo Markdown.",
            };
          }
          const checkMd = validateAllowedPath(resolvedMdPath, allowedPaths);
          if (!checkMd.allowed) return { success: false, error: checkMd.error };
          const mdContent = await fs.readFile(resolvedMdPath, "utf-8");
          const targetPdfPath = resolvedMdPath.replace(/\.md$/i, ".pdf");
          const checkPdf = validateAllowedPath(targetPdfPath, allowedPaths);
          if (!checkPdf.allowed) return { success: false, error: checkPdf.error };
          const renderRes = await renderResumeMarkdownToPdf({
            markdownContent: mdContent,
            outputPdfPath: targetPdfPath,
            roleTitle: roleTitle || matchedJob?.role,
          });
          if (!renderRes.success) {
            return { success: false, error: renderRes.error || "Falha ao renderizar PDF." };
          }
          if (matchedJob) {
            matchedJob.cvPdfPath = targetPdfPath;
            await saveAnalyzedJob(vaultPath, matchedJob, allowedPaths);
          }
          return {
            success: true,
            cvFilePath: resolvedMdPath,
            cvPdfFilePath: targetPdfPath,
            cvPdfFileName: path.basename(targetPdfPath),
            sizeBytes: renderRes.sizeBytes,
            engine: renderRes.engine,
            message: `PDF atualizado com sucesso em ${path.basename(targetPdfPath)} (${renderRes.sizeBytes} bytes).`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Erro ao exportar PDF do currículo: ${msg}` };
        }
      },
    }),
      /* _legacySkip start
          await fs.writeFile(targetPitchFile, pitchMarkdown, "utf-8");

          // Atualiza o registro no JSON
          const nowStr = new Date().toISOString().slice(0, 10);
          if (matchedJob) {
            matchedJob.cvPath = targetCvFile;
            matchedJob.pitchPath = targetPitchFile;
            matchedJob.status = "cv_gerado";
            matchedJob.statusUpdatedAt = nowStr;
            await saveAnalyzedJob(vaultPath, matchedJob, allowedPaths);
          }

          return {
            success: true,
            filePath: targetCvFile,
            cvFilePath: targetCvFile,
            cvFileName,
            pitchFilePath: targetPitchFile,
            pitchFileName,
            company,
            role,
            pitch,
            message: `Currículo adaptado (${cvFileName}) e Pitch + Guia ATS (${pitchFileName}) gerados com sucesso! Status da vaga atualizado para 'CV PRONTO'.`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha ao gerar currículo e pitch adaptados: ${msg}` };
        }
      },
    }),

      _legacySkip end */ update_job_application_status: tool({
      description:
        "Atualiza o status de uma candidatura no funil de vagas (Carreira/vagas-analisadas.json). Status aceitos: 'analisada', 'cv_gerado', 'aplicada', 'entrevista', 'rejeitada', 'oferta'.",
      parameters: z.object({
        jobId: z
          .string()
          .optional()
          .describe("ID específico da vaga (ex: '2026-10-implanta-desenvolvedor...')."),
        company: z
          .string()
          .optional()
          .describe("Nome da empresa para localizar a vaga correspondente."),
        status: z
          .enum(["analisada", "cv_gerado", "aplicada", "entrevista", "rejeitada", "oferta"])
          .describe("Novo status da vaga no funil de candidaturas."),
        notes: z
          .string()
          .optional()
          .describe("Anotações ou observações adicionais sobre o estágio da candidatura."),
      }),
      execute: async ({ jobId, company, status, notes }) => {
        try {
          if (!jobId && !company) {
            return {
              success: false,
              error: "Informe o jobId ou o nome da empresa para atualizar o status da candidatura.",
            };
          }

          await ensureCareerProfileExists(vaultPath, allowedPaths);
          const jobs = await loadAnalyzedJobs(vaultPath, allowedPaths);

          const matchedJob = jobs.find(
            (j) => (jobId && j.id === jobId) || (company && j.company.toLowerCase() === company.toLowerCase())
          );

          if (!matchedJob) {
            return {
              success: false,
              error: `Vaga não encontrada em Carreira/vagas-analisadas.json para ${jobId || company}.`,
            };
          }

          const nowStr = new Date().toISOString().slice(0, 10);
          matchedJob.status = status;
          matchedJob.statusUpdatedAt = nowStr;
          if (notes) {
            matchedJob.notes = notes;
          }

          await saveAnalyzedJob(vaultPath, matchedJob, allowedPaths);

          return {
            success: true,
            jobId: matchedJob.id,
            company: matchedJob.company,
            role: matchedJob.role,
            status,
            statusUpdatedAt: nowStr,
            notes: matchedJob.notes,
            message: `Status da candidatura para ${matchedJob.role} @ ${matchedJob.company} atualizado para '${status.toUpperCase()}'.`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha ao atualizar status da vaga: ${msg}` };
        }
      },
    }),

    generate_career_report: tool({
      description:
        "Analisa o histórico cumulativo de vagas avaliadas em Carreira/vagas-analisadas.json, consolida as tecnologias mais demandadas para o nível Pleno, elabora uma matriz de estudos dinâmica priorizada (Esforço vs Impacto) cruzada com materiais do MBA e atualiza a nota executiva Carreira/relatorio-gaps-mercado.md no Obsidian.",
      parameters: z.object({
        updateVaultNote: z
          .boolean()
          .optional()
          .default(true)
          .describe("Se true, grava e atualiza a nota executiva Carreira/relatorio-gaps-mercado.md no cofre do Obsidian."),
      }),
      execute: async ({ updateVaultNote = true }) => {
        try {
          await ensureCareerProfileExists(vaultPath, allowedPaths);

          const jobs = await loadAnalyzedJobs(vaultPath, allowedPaths);
          if (jobs.length === 0) {
            return {
              success: true,
              totalJobs: 0,
              message:
                "Nenhuma vaga analisada encontrada no histórico de Carreira/vagas-analisadas.json. Comece analisando uma vaga com a ferramenta analyze_job_posting ou enviando a URL de uma vaga no chat.",
            };
          }

          const totalJobs = jobs.length;
          const avgScore = Math.round(
            jobs.reduce((acc, j) => acc + (j.matchScore || 0), 0) / totalJobs
          );

          const verdictCounts = { sim: 0, comRessalvas: 0, nao: 0 };
          const skillCounts: Record<string, number> = {};
          const quickWinCounts: Record<string, number> = {};
          const criticalGapCounts: Record<string, number> = {};

          for (const job of jobs) {
            if (job.verdict === "Sim") verdictCounts.sim++;
            else if (job.verdict === "Com ressalvas") verdictCounts.comRessalvas++;
            else verdictCounts.nao++;

            for (const tech of job.keyTechnologies || []) {
              skillCounts[tech] = (skillCounts[tech] || 0) + 1;
            }
            for (const win of job.quickWins || []) {
              const label = win.split("(")[0].trim();
              quickWinCounts[label] = (quickWinCounts[label] || 0) + 1;
            }
            for (const gap of job.criticalGaps || []) {
              criticalGapCounts[gap] = (criticalGapCounts[gap] || 0) + 1;
            }
          }

          const topSkills = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([skill, count]) => ({
              skill,
              count,
              percentage: Math.round((count / totalJobs) * 100),
            }));

          const topQuickWins = Object.entries(quickWinCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([gap, count]) => ({ gap, count }));

          const topCriticalGaps = Object.entries(criticalGapCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([gap, count]) => ({ gap, count }));

          // Matriz de estudo dinâmica cruzando com materiais do MBA
          const { studyMatrix, weeklyStudyFocus } = buildDynamicStudyMatrix(
            jobs,
            topSkills,
            topCriticalGaps,
            topQuickWins
          );

          const reportDate = new Date().toISOString().slice(0, 10);
          const kanbanSummary = formatJobPipelineKanban(jobs);

          const reportMarkdown =
            `# 📊 Observatório de Mercado & Relatório de Gaps de Carreira\n` +
            `*Atualizado em: ${reportDate} | Amostra: ${totalJobs} vaga(s) analisada(s)*\n\n` +
            `---\n\n` +
            `## 📈 Panorama Geral das Vagas Avaliadas\n` +
            `- **Total de Vagas Analisadas:** ${totalJobs}\n` +
            `- **Média Geral de Aderência:** **${avgScore}%**\n` +
            `- **Foco de Estudo Recomendado para a Semana:** **${weeklyStudyFocus}**\n` +
            `- **Distribuição de Vereditos:**\n` +
            `  - 🟢 **Sim (Forte Aderência):** ${verdictCounts.sim} (${Math.round((verdictCounts.sim / totalJobs) * 100)}%)\n` +
            `  - 🟡 **Com Ressalvas (Aplicar Estratégico):** ${verdictCounts.comRessalvas} (${Math.round((verdictCounts.comRessalvas / totalJobs) * 100)}%)\n` +
            `  - 🔴 **Não Recomendadas:** ${verdictCounts.nao} (${Math.round((verdictCounts.nao / totalJobs) * 100)}%)\n\n` +
            `---\n\n` +
            `## 🏆 Top Tecnologias Mais Demandadas (Nível Pleno)\n` +
            `${topSkills.slice(0, 8).map((s) => `- **${s.skill}:** presente em ${s.count} vaga(s) (${s.percentage}%)`).join("\n") || "- Nenhuma stack recorrente identificada"}\n\n` +
            `---\n\n` +
            `## ⚡ Oportunidades Imediatas (Quick Wins do MBA USP/Esalq)\n` +
            `Requisitos técnicos pedidos nas vagas que você já possui embasamento conceitual e precisa apenas evidenciar no CV ou em repositórios:\n` +
            `${topQuickWins.map((w) => `- **${w.gap}:** requisitado em ${w.count} vaga(s)`).join("\n") || "- Nenhum gap conceitual recorrente"}\n\n` +
            `---\n\n` +
            `## 🎯 Matriz de Estudos Priorizados (Esforço vs Impacto)\n\n` +
            `| Área de Estudo | Ação Prática Recomendada | Recursos Locais (MBA / Projetos) | Esforço | Impacto | Prioridade |\n` +
            `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
            studyMatrix.map((m) => `| ${m.area} | ${m.action} | ${m.localResource || "Materiais locais"} | ${m.effort} | ${m.marketImpact} | **${m.priority}** |`).join("\n") +
            `\n\n---\n\n` +
            `## 💼 Pipeline de Candidaturas (Funil de Vagas)\n\n` +
            `\`\`\`\n${kanbanSummary}\`\`\`\n\n` +
            `---\n*Relatório gerado automaticamente pelo copiloto de carreira do Benito.*\n`;

          let notePath = "";
          if (updateVaultNote) {
            notePath = path.join(vaultPath, "Carreira", "relatorio-gaps-mercado.md");
            const check = validateAllowedPath(notePath, allowedPaths);
            if (check.allowed) {
              await fs.writeFile(notePath, reportMarkdown, "utf-8");
            }
          }

          return {
            success: true,
            totalJobsAnalyzed: totalJobs,
            averageMatchScore: avgScore,
            verdictDistribution: verdictCounts,
            topSkills,
            topQuickWins,
            topCriticalGaps,
            studyMatrix,
            weeklyStudyFocus,
            kanbanSummary,
            notePath: notePath || undefined,
            reportMarkdown,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha ao gerar relatório de carreira: ${msg}` };
        }
      },
    }),
  };
}
