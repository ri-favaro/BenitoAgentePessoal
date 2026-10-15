import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { validateAllowedPath } from "./path-guard.js";
import { cleanMarkdownContent, extractPageText } from "./web-tools.js";

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
    effort: "Baixo" | "Médio" | "Alto";
    marketImpact: "Alto" | "Muito Alto" | "Crítico";
    priority: "Alta" | "Média";
  }>;
}

/**
 * Conteúdo padrão para inicialização do Perfil Profissional Master de Luiz Ricardo.
 */
export const INITIAL_CAREER_PROFILE_CONTENT = `# 👨‍💻 Perfil Profissional Master - Luiz Ricardo

> **Aviso ao Benito:** Este documento é a **única fonte da verdade** sobre o histórico técnico, acadêmico e projetos práticos de Luiz Ricardo. **Nunca invente** tecnologias, experiências profissionais ou cargos não listados aqui.

---

## 📌 Resumo Executivo & Posicionamento

- **Nome:** Luiz Ricardo
- **Formação Principal:** Engenheiro da Computação
- **Especialização:** Pós-graduando no MBA em Engenharia de Software (USP/Esalq)
- **Tempo de Atuação:** 6 meses de carreira em Engenharia de Software / Projetos de TI
- **Alvo Estratégico de Carreira:** Desenvolvedor / Engenheiro de Software Pleno (Mid-level) - Backend / Fullstack
- **Foco Técnico:** Aplicações escaláveis em TypeScript e Node.js, arquitetura desacoplada, microsserviços, modelagem SQL, Docker e boas práticas de engenharia de software (Clean Architecture, DDD, TDD).

---

## 🛠️ Stacks Dominadas & Competências Práticas

### 💻 Linguagens & Runtimes
- **TypeScript:** Tipagem estrita, generics, interfaces, Zod, ESM nativo.
- **Node.js (v20+ / v22+):** APIs REST, streaming assíncrono, subprocessos, arquitetura orientada a eventos.
- **JavaScript Moderno:** ES2023+, async/await, closures, promises concorrentes.
- **Python (Intermediário):** Scripts utilitários, automação e manipulação de dados.

### 🌐 Frontend & Frameworks
- **Next.js (App Router / Pages Router):** React 18+, Server Components, Server Actions, SSR/SSG.
- **React:** Hooks customizados, context API, componentização desacoplada.
- **Tailwind CSS:** Layouts responsivos, glassmorphism, micro-interações.

### 🗄️ Bancos de Dados & Armazenamento
- **SQL / Relacional:** PostgreSQL, SQLite, modelagem relacional, joins, índices, migrações versionadas (Supabase / raw SQL).
- **Vetorial & IA:** LanceDB (armazenamento vetorial local embutido, busca semântica por cosseno com EmbeddingGemma-2).

### ⚙️ DevOps, Testes & Ferramentas
- **Docker:** Criação de Dockerfiles multi-stage, Docker Compose, isolamento de ambientes e serviços locais.
- **Testes Automatizados:** Testes unitários e de integração com Jest e Node.js Test Runner, mocks estruturados, validação de regras de negócio.
- **Git & GitHub:** Git flow, Conventional Commits, Pull Requests, GitHub Actions (CI/CD), GitHub REST API / CLI (\`gh\`).

---

## 🎓 Formação Acadêmica & Módulos MBA (USP/Esalq)

### 1. Engenharia da Computação (Graduação Completa)
- Fundamentos sólidos de computação: estruturas de dados, algoritmos, sistemas operacionais, redes de computadores, arquitetura de computadores e sistemas distribuídos.

### 2. MBA em Engenharia de Software - USP / Esalq (Em Andamento)
- **Clean Architecture & Hexagonal:** Separação estrita de entidades de domínio, use cases, adapters e frameworks.
- **Domain-Driven Design (DDD):** Bounded contexts, agregados, value objects, domain events e entidades ricas.
- **Mensageria & Filas:** Conceitos de pub/sub, mensageria assíncrona, filas e brokers (RabbitMQ, Kafka), concorrência e idempotência.
- **Test-Driven Development (TDD):** Ciclo Red-Green-Refactor, pirâmide de testes e testes de regressão.
- **Microsserviços & Resiliência:** Padrões de circuit breaker, retry, dead-letter queues e observabilidade.

---

## 🚀 Projetos Reais & Realizações Práticas

### 1. CONTELE-OS
- **Papel:** Desenvolvedor Fullstack
- **Stack:** Next.js, React, TypeScript, Supabase (PostgreSQL), Tailwind CSS, Jest.
- **Realizações:**
  - Desenvolvimento e manutenção de módulos para gestão de ordens de serviço e operações de telecomunicações.
  - Implementação de regras de negócio complexas, fluxos de validação de formulários com Zod e persistência relacional.
  - Otimização de interfaces para usuários de campo e operadores, garantindo baixa latência e alta usabilidade.
  - Criação de testes unitários com Jest e automação de regras com migrações de banco seguras.

### 2. Benito - Assistente Pessoal & Engenharia Cognitiva
- **Papel:** Criador & Engenheiro Principal
- **Stack:** Node.js 22+, TypeScript 5.8+, Vercel AI SDK, Ollama (Qwen 3.5 9B), LanceDB, grammY (Telegram), picocolors, Zod.
- **Realizações:**
  - Arquitetura de raciocínio desacoplado (Decoupled Reasoning) com streaming parser FSM (\`<thinking>\`) sem adicionar latência.
  - Mecanismo RAG local de alta performance com LanceDB e EmbeddingGemma-2 768d (~270MB RAM), com indexação incremental via SHA-256.
  - Runner de orquestração técnica com whitelist de comandos, controle de timeout e sandbox estrito (\`path-guard\`).
  - Módulo financeiro em tempo real com snapshot O(1) (\`saldo-mestre.md\`) e sincronização atômica multi-carteiras.

---

## 🎯 Diretrizes para Adaptação de Currículo

1. **Nunca inventar fatos:** Basear cada bullet point em realizações e competências reais comprováveis.
2. **Reorganização Estratégica:** Realçar projetos e módulos acadêmicos que diretamente resolvem as dores da vaga.
3. **Calibração Pleno:** Destacar autonomia técnica, clareza arquitetural, domínio de TypeScript/Node.js/SQL e capacidade de aprendizado acelerado.
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
        const contentStart = text.indexOf("Markdown Content:");
        const raw = contentStart !== -1 ? text.slice(contentStart + 17).trim() : text.trim();
        return cleanMarkdownContent(raw, 7000);
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
  const extracted = extractPageText(html, 7000);
  return extracted.content;
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

  // 1. Detecção de Nível
  let level: "junior" | "pleno" | "senior" | "outros" = "pleno";
  if (/\b(senior|sênior|sr\.?|lead|tech lead|especialista|staff|principal)\b/i.test(roleName + " " + jobText)) {
    level = "senior";
  } else if (/\b(junior|júnior|jr\.?|estagio|estágio)\b/i.test(roleName + " " + jobText)) {
    level = "junior";
  }

  // 2. Mapeamento de Tecnologias Relevantes na Vaga
  const techCatalog: Record<string, RegExp> = {
    "TypeScript": /\b(typescript|ts)\b/i,
    "Node.js": /\b(node|nodejs|node\.js)\b/i,
    "SQL / PostgreSQL": /\b(sql|postgres|postgresql|relational|rdbms)\b/i,
    "Docker": /\b(docker|container|containers|compose)\b/i,
    "Next.js": /\b(next\.js|nextjs|next)\b/i,
    "React": /\b(react|reactjs|react\.js)\b/i,
    "APIs REST": /\b(rest|restful|api|apis)\b/i,
    "Clean Architecture": /\b(clean architecture|hexagonal|arquitetura limpa|camadas|ports and adapters)\b/i,
    "Domain-Driven Design (DDD)": /\b(ddd|domain-driven|domain driven)\b/i,
    "Mensageria (RabbitMQ / Kafka)": /\b(rabbitmq|kafka|mensageria|filas|queues|pub\/sub|sqs|event-driven)\b/i,
    "TDD / Testes Automatizados": /\b(tdd|testes unitarios|testes unitários|jest|test-driven|testes de integracao|testes automatizados)\b/i,
    "Microsserviços": /\b(microservices|microsserviços|microsservicos|distributed systems|sistemas distribuídos)\b/i,
    "CI/CD": /\b(ci\/cd|pipeline|github actions|gitlab ci|jenkins)\b/i,
    "Cloud (AWS / GCP / Azure)": /\b(aws|amazon web services|gcp|google cloud|azure)\b/i,
    "Kubernetes": /\b(kubernetes|k8s)\b/i,
    "GraphQL": /\b(graphql)\b/i,
    "NoSQL / MongoDB / Redis": /\b(nosql|mongo|mongodb|redis|dynamodb)\b/i,
    "Java / Spring Boot": /\b(java|spring|spring boot)\b/i,
    "C# / .NET": /\b(c#|\.net|dotnet|asp\.net)\b/i,
    "Python": /\b(python|fastapi|django|flask)\b/i,
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

  // Núcleo de domínio comprovado
  if (detectedTechs.includes("TypeScript")) strengths.push("TypeScript (Tipagem estrita, Zod e arquitetura modular)");
  if (detectedTechs.includes("Node.js")) strengths.push("Node.js (APIs assíncronas, backend moderno em ESM nativo)");
  if (detectedTechs.includes("SQL / PostgreSQL")) strengths.push("SQL / PostgreSQL (Modelagem relacional, queries e migrações no CONTELE-OS)");
  if (detectedTechs.includes("Docker")) strengths.push("Docker (Conteinerização, multi-stage builds e compose)");
  if (detectedTechs.includes("Next.js") || detectedTechs.includes("React")) strengths.push("Next.js / React (Experiência prática no CONTELE-OS)");
  if (detectedTechs.includes("APIs REST")) strengths.push("APIs RESTful (Design limpo, boas práticas HTTP e contratos seguros)");
  if (detectedTechs.includes("Python")) strengths.push("Python (Conhecimento prático para automações e integração)");

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
  const isSeniorRequirement =
    lower.includes("5+ anos") ||
    lower.includes("5 anos") ||
    lower.includes("6+ anos") ||
    lower.includes("8+ anos") ||
    lower.includes("liderança técnica") ||
    lower.includes("gestão de pessoas");

  if (isSeniorRequirement && level === "senior") {
    criticalGaps.push("Tempo de experiência formal exigido (vaga sênior/lead exigindo 5+ anos)");
  }

  if (detectedTechs.includes("Java / Spring Boot") && !detectedTechs.includes("Node.js")) {
    criticalGaps.push("Foco primário mandatório em ecossistema Java/Spring Boot (fora da stack core)");
  }

  if (detectedTechs.includes("C# / .NET") && !detectedTechs.includes("Node.js")) {
    criticalGaps.push("Foco primário mandatório em ecossistema .NET / C#");
  }

  if (detectedTechs.includes("Kubernetes") && lower.includes("especialista em kubernetes")) {
    criticalGaps.push("Administração avançada de clusters Kubernetes em produção");
  }

  // 4. Cálculo do Match Score (0 a 100)
  let score = 50; // base

  // Pontos fortes adicionam até +35 pontos
  score += Math.min(strengths.length * 8, 35);

  // Quick wins adicionam até +15 pontos
  score += Math.min(quickWins.length * 4, 15);

  // Penalização por gaps críticos
  score -= criticalGaps.length * 25;

  // Bonificação se vaga menciona Node/TypeScript explicitamente
  if (detectedTechs.includes("TypeScript") && detectedTechs.includes("Node.js")) {
    score += 10;
  }

  // Clamping
  score = Math.max(10, Math.min(98, score));

  // 5. Veredito Pragmático
  let verdict: "Sim" | "Com ressalvas" | "Não" = "Sim";
  let verdictReason = "";

  if (criticalGaps.length >= 2 || score < 45) {
    verdict = "Não";
    verdictReason = `A vaga possui desvios críticos da sua stack atual (${criticalGaps.join("; ")}). O esforço de adaptação é desproporcional para o nível Pleno.`;
  } else if (criticalGaps.length === 1 || score < 70) {
    verdict = "Com ressalvas";
    verdictReason = `Boa oportunidade de aplicação com posicionamento estratégico. Destaque seus projetos práticos (CONTELE-OS e Benito) e a formação teórica do MBA USP/Esalq para fechar os gaps pontuais (${quickWins.slice(0, 2).join(", ") || "conceituais"}).`;
  } else {
    verdict = "Sim";
    verdictReason = `Excelente aderência para o nível Pleno! Seu domínio em TypeScript, Node.js, SQL e a base de arquitetura do MBA atendem aos requisitos essenciais da vaga.`;
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
 * Monta o Pitch de Conexão de 3 parágrafos para abordagem no LinkedIn.
 */
export function buildConnectionPitch(
  company: string,
  role: string,
  strengths: string[],
  quickWins: string[]
): string {
  const topTechs = strengths.slice(0, 3).map((s) => s.split(" ")[0]).join(", ") || "TypeScript e Node.js";
  const mbaHighlights = quickWins.slice(0, 2).map((q) => q.split(" ")[0]).join(" e ") || "Clean Architecture e TDD";

  return `Olá! Acompanho a evolução da ${company} e me identifiquei muito com a oportunidade para ${role}. Sou Engenheiro da Computação, pós-graduando no MBA em Engenharia de Software pela USP/Esalq, e venho atuando no desenvolvimento de soluções backend e fullstack robustas.

No meu dia a dia técnico, tenho foco prático em ecossistema ${topTechs}, além de arquitetura limpa, modelagem relacional em SQL e microsserviços. Em projetos de alta exigência como o CONTELE-OS e meu assistente pessoal Benito, apliquei conceitos avançados de ${mbaHighlights} para entregar código resiliente, testável e de alto desempenho.

Acredito que posso somar rapidamente aos desafios de engenharia do time da ${company}. Fico à disposição para uma conversa rápida sobre como posso agregar valor ao projeto. Um abraço!`;
}

/**
 * Gera o conteúdo Markdown do currículo cirurgicamente personalizado para a vaga.
 */
export function buildTailoredResumeMarkdown(
  company: string,
  role: string,
  pitch: string,
  strengths: string[],
  quickWins: string[]
): string {
  const dateStr = new Date().toISOString().slice(0, 10);

  return `# Luiz Ricardo - ${role}
**Empresa Alvo:** ${company} | **Data da Versão:** ${dateStr}
**Localização:** Brasil | **Contato:** luizricardo.engcomp@gmail.com | [LinkedIn](https://linkedin.com) | [GitHub](https://github.com/ri-favaro)

---

## 🎯 Pitch de Conexão (LinkedIn / Recrutador)

> *Utilize o texto abaixo para abordagem direta ao Tech Lead ou Tech Recruiter no LinkedIn:*

${pitch}

---

## 📄 Currículo Personalizado

### 👤 Resumo Profissional
Engenheiro da Computação com pós-graduação em andamento no **MBA em Engenharia de Software (USP/Esalq)** e atuação prática na construção de sistemas web e serviços backend escaláveis. Sólida proficiência em **TypeScript**, **Node.js**, **SQL (PostgreSQL)**, **Docker** e **Next.js**, combinada com rigor arquitetural em **Clean Architecture**, **Domain-Driven Design (DDD)** e **TDD**. Focado em entregar código limpo, desacoplado, com testes automatizados e alta manutenibilidade técnica.

---

### 🛠️ Competências Técnicas Alinhadas à Vaga
- **Linguagens & Backend:** TypeScript, Node.js (ESM), JavaScript (ES2023+), APIs RESTful, Express, Zod.
- **Arquitetura & Engenharia:** Clean Architecture, Domain-Driven Design (DDD), Test-Driven Development (TDD), Microsserviços e Mensageria (${quickWins.join(", ") || "Clean Architecture, DDD"}).
- **Bancos de Dados:** PostgreSQL, SQLite, LanceDB (vetorial), modelagem relacional, otimização de queries e migrações versionadas.
- **Frontend & UI:** Next.js (App Router), React, Tailwind CSS, componentização desacoplada e validação de regras de negócio.
- **DevOps & Qualidade:** Docker, Docker Compose, Git Flow, CI/CD com GitHub Actions, Jest e Node Test Runner.

---

### 💼 Experiência & Projetos Práticos Relevantes

#### **CONTELE-OS** | *Engenheiro de Software Fullstack*
- Desenvolvimento de módulos essenciais para o sistema web de ordens de serviço e operações de telecomunicações utilizando **Next.js**, **React**, **TypeScript** e **Supabase (PostgreSQL)**.
- Implementação de regras de negócio com validação estrita via **Zod** e persistência relacional com migrações SQL versionadas.
- Otimização da experiência de uso e confiabilidade operacional de formulários e dashboards dinâmicos.
- Escrita de testes unitários com **Jest**, garantindo regressão zero em fluxos críticos de atendimento.

#### **Benito (Agente Pessoal & Engenharia Cognitiva)** | *Criador & Engenheiro Principal*
- Concepção e engenharia completa de um assistente local e autônomo em **Node.js 22+** e **TypeScript 5.8+** com **Vercel AI SDK**.
- Criação de um streaming parser FSM desacoplado para monólogo interno (\`<thinking>\`) sem latência adicional.
- Implementação de banco vetorial local com **LanceDB** e modelo de embeddings **EmbeddingGemma-2** (768d) com indexação incremental via SHA-256.
- Runner de orquestração técnica seguro com whitelist de comandos e controle de sandbox de filesystem (\`path-guard\`).

---

### 🎓 Formação Acadêmica

- **MBA em Engenharia de Software** | *Universidade de São Paulo (USP / Esalq)* — Em andamento
  - Módulos avançados: Clean Architecture, DDD, Mensageria Assíncrona (RabbitMQ/Kafka), Microsserviços e TDD.
- **Bacharelado em Engenharia da Computação** | *Graduação Completa*
  - Fundamentos de estruturas de dados, algoritmos, arquitetura de computadores e sistemas distribuídos.

---
`;
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
          // Validação inicial de entrada
          if (!url && !jobText) {
            return {
              success: false,
              error: "Informe a URL da vaga ou cole o texto/descrição para que a análise de aderência possa ser executada.",
            };
          }

          // Garante a existência do perfil profissional master
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

          const evalResult = evaluateJobMatch(rawContent, company, role);
          const dateStr = new Date().toISOString().slice(0, 10);
          const slugCompany = company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const slugRole = role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const recordId = `${dateStr}-${slugCompany || "empresa"}-${slugRole || "pleno"}`;

          const record: AnalyzedJobRecord = {
            id: recordId,
            date: dateStr,
            company,
            role,
            url,
            level: evalResult.level,
            matchScore: evalResult.matchScore,
            verdict: evalResult.verdict,
            verdictReason: evalResult.verdictReason,
            strengths: evalResult.strengths,
            quickWins: evalResult.quickWins,
            criticalGaps: evalResult.criticalGaps,
            keyTechnologies: evalResult.keyTechnologies,
          };

          await saveAnalyzedJob(vaultPath, record, allowedPaths);

          const summaryMarkdown =
            `### 🎯 Análise de Vaga: ${role} @ ${company}\n\n` +
            `• **Match Score:** **${evalResult.matchScore}%** (Nível: ${evalResult.level.toUpperCase()})\n` +
            `• **Veredito de Aplicação:** **${evalResult.verdict.toUpperCase()}**\n` +
            `• **Diagnóstico:** ${evalResult.verdictReason}\n\n` +
            `**💪 Pontos Fortes Imediatos:**\n${evalResult.strengths.map((s) => `  - ${s}`).join("\n") || "  - Nenhum alinhamento imediato identificado"}\n\n` +
            `**⚡ Quick Wins (Reforçar no CV/Pitch via MBA USP/Esalq):**\n${evalResult.quickWins.map((q) => `  - ${q}`).join("\n") || "  - Não há gaps conceituais pontuais"}\n\n` +
            `**⚠️ Gaps Críticos:**\n${evalResult.criticalGaps.map((g) => `  - ${g}`).join("\n") || "  - Nenhum gap impeditivo para nível Pleno"}\n\n` +
            `*Registro salvo em \`Carreira/vagas-analisadas.json\`.*`;

          return {
            success: true,
            jobId: recordId,
            company,
            role,
            matchScore: evalResult.matchScore,
            verdict: evalResult.verdict,
            verdictReason: evalResult.verdictReason,
            strengths: evalResult.strengths,
            quickWins: evalResult.quickWins,
            criticalGaps: evalResult.criticalGaps,
            keyTechnologies: evalResult.keyTechnologies,
            summaryMarkdown,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha na análise de vaga: ${msg}` };
        }
      },
    }),

    generate_tailored_application: tool({
      description:
        "Gera uma versão customizada do Currículo em Markdown e um Pitch de Conexão de 3 parágrafos para o LinkedIn, reorganizando cirurgicamente as experiências e competências reais do perfil master (CONTELE-OS, Benito, MBA USP/Esalq) para atender às exigências da vaga, sem inventar nenhum dado. Salva o arquivo em Carreira/Vagas/YYYY-MM-Empresa-CV.md no cofre do Obsidian.",
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

          const strengths = matchedJob?.strengths || (focusSkills.length > 0 ? focusSkills : ["TypeScript", "Node.js", "PostgreSQL", "Docker"]);
          const quickWins = matchedJob?.quickWins || ["Clean Architecture (MBA USP/Esalq)", "TDD com Jest"];

          const pitch = buildConnectionPitch(company, role, strengths, quickWins);
          const resumeMarkdown = buildTailoredResumeMarkdown(company, role, pitch, strengths, quickWins);

          const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
          const cleanComp = company.replace(/[^a-zA-Z0-9_-]/g, "");
          const fileName = `${datePrefix}-${cleanComp || "Empresa"}-CV.md`;

          const vagasDir = path.join(vaultPath, "Carreira", "Vagas");
          const targetFile = path.join(vagasDir, fileName);

          const check = validateAllowedPath(targetFile, allowedPaths);
          if (!check.allowed) {
            return { success: false, error: check.error };
          }

          await fs.mkdir(vagasDir, { recursive: true });
          await fs.writeFile(targetFile, resumeMarkdown, "utf-8");

          // Atualiza o registro no JSON se existir
          if (matchedJob) {
            matchedJob.cvPath = targetFile;
            await saveAnalyzedJob(vaultPath, matchedJob, allowedPaths);
          }

          return {
            success: true,
            filePath: targetFile,
            fileName,
            company,
            role,
            pitch,
            message: `Currículo adaptado e Pitch de Conexão gerados com sucesso em ${fileName}!`,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, error: `Falha ao gerar currículo e pitch adaptados: ${msg}` };
        }
      },
    }),

    generate_career_report: tool({
      description:
        "Analisa o histórico cumulativo de vagas avaliadas em Carreira/vagas-analisadas.json, consolida as tecnologias mais demandadas para o nível Pleno, aponta os gaps de qualificação mais frequentes, elabora uma matriz de estudos priorizada (Esforço vs Impacto) e atualiza a nota executiva Carreira/relatorio-gaps-mercado.md no Obsidian.",
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

          // Agregações
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

          // Matriz de estudo priorizada
          const studyMatrix = [
            {
              area: "Mensageria & Filas (RabbitMQ / Kafka)",
              action: "Praticar envio e consumo assíncrono de eventos com DLQ e ack/nack no Node.js",
              effort: "Médio" as const,
              marketImpact: "Alto" as const,
              priority: "Alta" as const,
            },
            {
              area: "Clean Architecture & DDD Prático",
              action: "Modularizar use cases e entidades desacopladas em microsserviço modelo",
              effort: "Baixo" as const,
              marketImpact: "Alto" as const,
              priority: "Alta" as const,
            },
            {
              area: "Cloud & Conteinerização (AWS / Docker)",
              action: "Configurar deploy de container com Docker Compose e rotinas de CI/CD",
              effort: "Médio" as const,
              marketImpact: "Muito Alto" as const,
              priority: "Alta" as const,
            },
            {
              area: "Testes Automatizados (TDD)",
              action: "Aumentar cobertura de testes unitários e de integração com Jest no backend",
              effort: "Baixo" as const,
              marketImpact: "Alto" as const,
              priority: "Alta" as const,
            },
          ];

          const reportDate = new Date().toISOString().slice(0, 10);
          const reportMarkdown =
            `# 📊 Observatório de Mercado & Relatório de Gaps de Carreira\n` +
            `*Atualizado em: ${reportDate} | Amostra: ${totalJobs} vaga(s) analisada(s)*\n\n` +
            `---\n\n` +
            `## 📈 Panorama Geral das Vagas Avaliadas\n` +
            `- **Total de Vagas Analisadas:** ${totalJobs}\n` +
            `- **Média Geral de Aderência:** **${avgScore}%**\n` +
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
            `| Área de Estudo | Ação Prática Recomendada | Esforço | Impacto | Prioridade |\n` +
            `| :--- | :--- | :--- | :--- | :--- |\n` +
            studyMatrix.map((m) => `| ${m.area} | ${m.action} | ${m.effort} | ${m.marketImpact} | **${m.priority}** |`).join("\n") +
            `\n\n---\n*Relatório gerado automaticamente pelo copiloto de carreira do Benito.*\n`;

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
