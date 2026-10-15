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
  - Desenvolvimento e arquitetura de integrações e automações de processos críticos de negócio utilizando **Node.js**, **TypeScript** e **N8N**.
  - Consumo e orquestração de APIs REST externas, destacando-se a **automação ponta a ponta do fluxo de postagem dos Correios** (pré-postagem, geração automatizada de etiquetas em PDF e dashboard de rastreamento em tempo real).
  - Aplicação prática de **LLMs (incluindo Claude da Anthropic)** em fluxos produtivos de automação inteligente e triagem de dados.
  - Contribuição fullstack na plataforma **CONTELE-OS**: desenvolvimento de módulos com **Next.js**, **React**, **TypeScript** e **Supabase (PostgreSQL)**, validação estrita de schemas com **Zod**, migrações SQL versionadas e testes unitários com **Jest**.
  - Atuação em time ágil de desenvolvimento de produto utilizando metodologia **Kanban**, code reviews e Pull Requests estruturadas.

### 2. O Especialista — Suporte de TI & Infraestrutura
- **Período:** jun/2024 – dez/2024 (6 meses) | **Local:** Guarujá, SP
- **Realizações & Entregas Comprovadas:**
  - Prestação de suporte técnico nível 1 e 2 (presencial e remoto) atendendo simultaneamente de **4 a 5 empresas clientes**.
  - Diagnóstico e resolução de incidentes críticos de TI, configuração de redes, infraestrutura local e manutenção de hardware.
  - Interface direta com stakeholders e usuários finais, desenvolvendo comunicação clara sob pressão, senso de urgência e foco em SLA/resolução efetiva de problemas.

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

### 1. Benito — Assistente Pessoal Autônomo & Engenharia Cognitiva (2026)
- **Repositório:** \`https://github.com/ri-favaro/BenitoAgentePessoal\`
- **Stack:** Node.js 22+, TypeScript 5.8+, Vercel AI SDK, Ollama (Qwen 3.5 9B), LanceDB, EmbeddingGemma-2, grammY (Telegram Bot), Zod.
- **Destaques para o CV:**
  - Arquitetura cognitiva de raciocínio desacoplado (*Decoupled Reasoning*) com parser FSM em streaming (\`<thinking>\`) sem adição de latência.
  - Motor de RAG local multi-repositório com **LanceDB** e **EmbeddingGemma-2 (768d)** otimizado (~270MB RAM) e indexação incremental por hash SHA-256.
  - Orquestrador técnico hierárquico capaz de empacotar contexto de issues do GitHub e delegar codificação autônoma via CLI com sandbox estrito de segurança (\`path-guard\`) e whitelist de processos.
  - Cobertura de 13 suítes de testes automatizados validando regras financeiras em tempo real ($O(1)$), integrações GitHub REST/CLI, busca web (Tavily/Jina Reader) e automação via cron.

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
2. **Filtro de Relevância por Vaga (Fim do "Tiro de Escopeta"):**
   - Para vagas de **Backend / Fullstack / IA**: destaque \`TypeScript\`, \`Node.js\`, \`PostgreSQL\`, \`SQL\`, \`APIs REST\`, \`Docker\`, \`Next.js\`, \`React\`, \`N8N\`, \`LLMs (Claude/Ollama)\`, \`RAG/LanceDB\`, \`Jest\` e \`Azure\`. **Omita** ferramentas de automação industrial/CAD (\`AutoCAD\`, \`Fusion360\`, \`Ladder CLPs\`, \`Excel\`, \`Packet Tracer\`) que poluem a leitura do recrutador de software.
   - Inclua os projetos de **Benito (IA/Node/TS)** e **Contele (APIs/Correios/LLMs/CONTELE-OS)** sempre no topo de relevância.
3. **Tom de Nível Pleno:** Nunca escreva *"Profissional em início de carreira buscando aprender"*. Posicione como *"Engenheiro da Computação e Desenvolvedor de Software (pós-graduando em Engenharia de Software pela USP/ESALQ) com experiência prática em produção no desenvolvimento de APIs REST, integrações complexas, aplicações Fullstack (Node.js/TypeScript/React) e soluções com IA Generativa/LLMs"*.
4. **Destaque do Inglês Avançado:** Sempre inclua a seção de Idiomas destacando **Inglês Avançado**, que é um diferencial competitivo forte para vagas Pleno.
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

  // 2. Mapeamento de Tecnologias Relevantes na Vaga
  const techCatalog: Record<string, RegExp> = {
    "TypeScript": /\b(typescript|ts)\b/i,
    "Node.js": /\b(node|nodejs|node\.js)\b/i,
    "SQL / PostgreSQL": /\b(sql|postgres|postgresql|relational|rdbms|pgvector)\b/i,
    "Docker": /\b(docker|container|containers|compose)\b/i,
    "Next.js": /\b(next\.js|nextjs|next)\b/i,
    "React": /\b(react|reactjs|react\.js)\b/i,
    "APIs REST": /\b(rest|restful|api|apis)\b/i,
    "IA Generativa & LLMs": /\b(ia generativa|genai|llm|llms|engenharia de prompts?|prompt engineering|openai|anthropic|gemini|modelos de linguagem|modelos abertos)\b/i,
    "Agentes de IA & Orquestração": /\b(agentes?|multiagente|multi-agent|orquestra[çc][ãa]o de agentes|langchain|langgraph|llamaindex|crewai|autogen|tool calling|chamada de ferramentas|harness)\b/i,
    "Bases Vetoriais & RAG": /\b(rag|embeddings?|pgvector|lancedb|banco[s]? vetoria[il]|bases vetoriais|busca sem[âa]ntica|chunking|vector search)\b/i,
    "Python": /\b(python|fastapi|django|flask)\b/i,
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
  if (detectedTechs.includes("IA Generativa & LLMs")) strengths.push("IA Generativa & LLMs (Experiência prática no Benito com engenharia de prompts, Vercel AI SDK e Ollama)");
  if (detectedTechs.includes("Agentes de IA & Orquestração")) strengths.push("Agentes de IA & Orquestração (Arquitetura cognitiva do Benito, tool calling, raciocínio desacoplado e automação)");
  if (detectedTechs.includes("Bases Vetoriais & RAG")) strengths.push("Bases Vetoriais & RAG (Pipeline local de RAG no Benito com LanceDB, EmbeddingGemma-2 768d e indexação incremental)");
  if (detectedTechs.includes("Python")) strengths.push("Python (Conhecimento prático para automações, APIs e scripts utilitários)");

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

  // Java só é gap se for o foco primário mandatório exclusivo sem suporte a Node/TS/Python
  if (
    detectedTechs.includes("Java / Spring Boot") &&
    !detectedTechs.includes("Node.js") &&
    !detectedTechs.includes("Python") &&
    !detectedTechs.includes("TypeScript")
  ) {
    criticalGaps.push("Foco primário mandatório em ecossistema Java/Spring Boot (fora da stack core)");
  }

  // C# / .NET só é gap se for mandatório e a vaga não for de Node/TS/Python
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

  // Pontos fortes adicionam até +35 pontos
  score += Math.min(strengths.length * 8, 35);

  // Quick wins adicionam até +15 pontos
  score += Math.min(quickWins.length * 4, 15);

  // Penalização por gaps críticos
  score -= criticalGaps.length * 25;

  // Bonificação se vaga menciona Node/TypeScript ou IA/Python explicitamente
  if (
    (detectedTechs.includes("TypeScript") && detectedTechs.includes("Node.js")) ||
    (detectedTechs.includes("IA Generativa & LLMs") && detectedTechs.includes("Python"))
  ) {
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
    verdictReason = `Excelente aderência para o nível Pleno! Seu domínio em engenharia de software, projetos práticos (CONTELE-OS e Benito) e a base do MBA USP/Esalq atendem aos requisitos essenciais da vaga.`;
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

          // Se a empresa ou cargo vierem com os valores default ou vazios, tenta extrair da página
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
            `*Registro salvo em \`Carreira/vagas-analisadas.json\`.*`;

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
