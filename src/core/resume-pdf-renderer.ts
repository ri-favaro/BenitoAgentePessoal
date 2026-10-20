import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ResumeContactHeader {
  name: string;
  roleTitle: string;
  location: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  githubUrl: string;
}

export interface RenderResumePdfOptions {
  markdownContent: string;
  outputPdfPath: string;
  roleTitle?: string;
  browserPathOverride?: string;
}

export interface RenderResumePdfResult {
  success: boolean;
  outputPdfPath: string;
  engine: "chromium-headless" | "fallback-vector-pdf";
  sizeBytes: number;
  error?: string;
}

const DEFAULT_HEADER: ResumeContactHeader = {
  name: "Luiz Ricardo Favaro",
  roleTitle: "Desenvolvedor de Software",
  location: "Guarujá, São Paulo.",
  email: "ricardofavaro6@gmail.com",
  phone: "(13) 98174-8698 (WhatsApp)",
  linkedinUrl: "https://www.linkedin.com/in/ri-favaro/",
  githubUrl: "https://github.com/ri-favaro",
};

/**
 * Remove emojis decorativos de títulos para garantir visual 100% humano e compatível com ATS.
 */
export function stripDecorativeEmojis(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Converte formatação inline Markdown (**negrito**, *itálico*, [link](url), URLs puras) para HTML seguro.
 */
export function formatInlineMarkdownToHtml(line: string): string {
  let text = escapeHtml(line);

  // Links no formato [label](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label: string, url: string) => {
      return `<a href="${url}">${label}</a>`;
    }
  );

  // Negrito **texto**
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Itálico *texto*
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Código inline `texto`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  return text;
}

/**
 * Converte o Markdown estruturado do currículo em um documento HTML5 + CSS3
 * calibrado para A4 (máx. 2 páginas), ATS-friendly e espelhando o design de CurriculoLuizRicardo-2026-v3.pdf.
 */
export function buildResumeHtmlFromMarkdown(
  markdownContent: string,
  roleOverride?: string
): string {
  const rawLines = markdownContent.replace(/\r\n/g, "\n").split("\n");

  let headerName = DEFAULT_HEADER.name;
  let headerRole = roleOverride ? stripDecorativeEmojis(roleOverride) : DEFAULT_HEADER.roleTitle;

  const bodyHtmlParts: string[] = [];
  let inList = false;
  let inBlockquote = false;

  const closeOpenBlocks = () => {
    if (inList) {
      bodyHtmlParts.push("</ul>");
      inList = false;
    }
    if (inBlockquote) {
      bodyHtmlParts.push("</div>");
      inBlockquote = false;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    if (!line) {
      closeOpenBlocks();
      continue;
    }

    // Ignora separadores horizontais redundantes e metadados internos de controle
    if (/^---+$/.test(line)) {
      closeOpenBlocks();
      continue;
    }
    if (
      line.includes("Empresa Alvo:") ||
      line.includes("Data da Versão:") ||
      line.startsWith("**Localização:**") ||
      line.startsWith("**Perfis:**") ||
      line.startsWith("**Contato:**") ||
      line.startsWith("LinkedIn:") ||
      line.startsWith("Guarujá, São Paulo")
    ) {
      continue;
    }

    // H1: Nome e Cargo no topo (# Luiz Ricardo Favaro - Cargo)
    if (line.startsWith("# ")) {
      closeOpenBlocks();
      const h1Clean = stripDecorativeEmojis(line.slice(2));
      if (h1Clean.includes(" - ")) {
        const [n, r] = h1Clean.split(" - ", 2);
        headerName = n.trim() || DEFAULT_HEADER.name;
        if (!roleOverride && r?.trim()) {
          headerRole = r.trim();
        }
      } else if (h1Clean.includes(" — ")) {
        const [n, r] = h1Clean.split(" — ", 2);
        headerName = n.trim() || DEFAULT_HEADER.name;
        if (!roleOverride && r?.trim()) {
          headerRole = r.trim();
        }
      } else {
        headerName = h1Clean || DEFAULT_HEADER.name;
      }
      continue;
    }

    // H2: Seções principais (Resumo Profissional, Experiência Profissional, Habilidades Técnicas, etc.)
    if (line.startsWith("## ")) {
      closeOpenBlocks();
      const sectionTitle = stripDecorativeEmojis(line.slice(3));
      bodyHtmlParts.push(`<h2 class="section-title">${escapeHtml(sectionTitle)}</h2>`);
      continue;
    }

    // H3 / H4: Subtítulos de Experiência ou Projetos
    if (line.startsWith("### ") || line.startsWith("#### ")) {
      closeOpenBlocks();
      const rawSub = line.replace(/^#{3,4}\s+/, "");
      const cleanSub = stripDecorativeEmojis(rawSub);
      bodyHtmlParts.push(`<div class="entry-header">${formatInlineMarkdownToHtml(cleanSub)}</div>`);
      continue;
    }

    // Bullets (- ou •)
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      if (!inList) {
        bodyHtmlParts.push('<ul class="resume-list">');
        inList = true;
      }
      const itemContent = stripDecorativeEmojis(line.slice(2));
      bodyHtmlParts.push(`<li>${formatInlineMarkdownToHtml(itemContent)}</li>`);
      continue;
    }

    // Linha de período/local em itálico logo abaixo do cargo (ex: *Santos, SP | abr/2026 – atual*)
    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      closeOpenBlocks();
      const metaText = stripDecorativeEmojis(line.slice(1, -1));
      bodyHtmlParts.push(`<div class="entry-meta">${escapeHtml(metaText)}</div>`);
      continue;
    }

    // Parágrafo normal (Resumo Profissional, descrição de projeto, etc.)
    closeOpenBlocks();
    bodyHtmlParts.push(
      `<p class="resume-paragraph">${formatInlineMarkdownToHtml(stripDecorativeEmojis(line))}</p>`
    );
  }

  closeOpenBlocks();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(headerName)} - ${escapeHtml(headerRole)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 13mm 16mm 13mm 16mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0;
      padding: 0;
      font-family: Arial, "Helvetica Neue", Helvetica, "Segoe UI", sans-serif;
      font-size: 9.8pt;
      line-height: 1.36;
      color: #111111;
      background: #ffffff;
    }

    a {
      color: #1155cc;
      text-decoration: underline;
    }

    /* Cabeçalho idêntico ao CurriculoLuizRicardo-2026-v3.pdf */
    .resume-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 6px;
    }

    .resume-name {
      font-size: 16.5pt;
      font-weight: 700;
      margin: 0 0 2px 0;
      color: #000000;
      letter-spacing: 0.1px;
    }

    .resume-role {
      font-size: 11.5pt;
      font-weight: 700;
      margin: 0 0 7px 0;
      color: #111111;
    }

    .resume-contact-line {
      font-size: 9.2pt;
      line-height: 1.35;
      color: #222222;
      margin: 1px 0;
    }

    .resume-contact-label {
      color: #2f5597;
      font-weight: 500;
    }

    /* Seções principais */
    .section-title {
      font-size: 11.8pt;
      font-weight: 700;
      color: #000000;
      margin: 11px 0 5px 0;
      padding-bottom: 2px;
      border-bottom: 1px solid #d0d5dd;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Títulos de experiência e projetos */
    .entry-header {
      font-size: 10.2pt;
      margin-top: 7px;
      margin-bottom: 1px;
      color: #000000;
      page-break-after: avoid;
      break-after: avoid;
    }

    .entry-meta {
      font-size: 9.3pt;
      font-style: italic;
      color: #333333;
      margin-bottom: 3px;
      page-break-after: avoid;
      break-after: avoid;
    }

    .resume-paragraph {
      margin: 4px 0 6px 0;
      text-align: justify;
      text-indent: 0;
    }

    .resume-list {
      margin: 3px 0 6px 0;
      padding-left: 18px;
    }

    .resume-list li {
      margin-bottom: 2.5px;
      text-align: left;
    }

    strong {
      font-weight: 700;
      color: #000000;
    }
  </style>
</head>
<body>
  <header class="resume-header">
    <h1 class="resume-name">${escapeHtml(headerName)}</h1>
    <div class="resume-role">${escapeHtml(headerRole)}</div>
    <div class="resume-contact-line">
      <span class="resume-contact-label">LinkedIn:</span> <a href="${DEFAULT_HEADER.linkedinUrl}">${DEFAULT_HEADER.linkedinUrl}</a> |
      <span class="resume-contact-label">Email:</span> <a href="mailto:${DEFAULT_HEADER.email}">${DEFAULT_HEADER.email}</a>
    </div>
    <div class="resume-contact-line">
      <span class="resume-contact-label">GitHub:</span> <a href="${DEFAULT_HEADER.githubUrl}">${DEFAULT_HEADER.githubUrl}</a> |
      ${escapeHtml(DEFAULT_HEADER.phone)} | ${escapeHtml(DEFAULT_HEADER.location)}
    </div>
  </header>

  <main>
    ${bodyHtmlParts.join("\n    ")}
  </main>
</body>
</html>`;
}

/**
 * Localiza o binário do navegador baseado em Chromium instalado no sistema (Edge ou Chrome).
 */
export function findSystemChromiumBinary(overridePath?: string): string | null {
  if (overridePath && fsSync.existsSync(overridePath)) {
    return overridePath;
  }

  const candidates = [
    process.env.BENITO_PDF_BROWSER_PATH || "",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Gerador determinístico de PDF vetorial mínimo em puro TypeScript (fallback para ambientes sem navegador).
 */
export function generateFallbackVectorPdfBuffer(plainTextContent: string): Buffer {
  const sanitizePdfText = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/([()\\])/g, "\\$1");

  const lines = plainTextContent
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => sanitizePdfText(stripDecorativeEmojis(l)))
    .filter((l) => l.length > 0)
    .slice(0, 65);

  const textOps = lines
    .map((line, idx) => {
      const y = 800 - idx * 11;
      return `BT /F1 9 Tf 40 ${y} Td (${line.slice(0, 95)}) Tj ET`;
    })
    .join("\n");

  const streamContent = `${textOps}\n`;
  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(streamContent, "utf-8")} >>\nstream\n${streamContent}endstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Renderiza o conteúdo Markdown do currículo em um arquivo PDF vetorial ATS-friendly.
 */
export async function renderResumeMarkdownToPdf(
  options: RenderResumePdfOptions
): Promise<RenderResumePdfResult> {
  const { markdownContent, outputPdfPath, roleTitle, browserPathOverride } = options;

  await fs.mkdir(path.dirname(outputPdfPath), { recursive: true });

  const html = buildResumeHtmlFromMarkdown(markdownContent, roleTitle);
  const browserExe = findSystemChromiumBinary(browserPathOverride);

  if (browserExe) {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempDir = path.join(os.tmpdir(), `benito-pdf-${uniqueSuffix}`);
    const tempHtmlPath = path.join(tempDir, "resume.html");
    const tempProfileDir = path.join(tempDir, "profile");

    try {
      await fs.mkdir(tempProfileDir, { recursive: true });
      await fs.writeFile(tempHtmlPath, html, "utf-8");

      // Remove PDF anterior se existir para garantir verificação limpa
      try {
        await fs.unlink(outputPdfPath);
      } catch {
        // arquivo ainda nao existia
      }

      const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, "/")}`;
      await execFileAsync(
        browserExe,
        [
          "--headless",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
          `--user-data-dir=${tempProfileDir}`,
          "--no-pdf-header-footer",
          `--print-to-pdf=${outputPdfPath}`,
          fileUrl,
        ],
        {
          timeout: 25000,
          windowsHide: true,
        }
      );

      const stat = await fs.stat(outputPdfPath);
      if (stat.size > 500) {
        return {
          success: true,
          outputPdfPath,
          engine: "chromium-headless",
          sizeBytes: stat.size,
        };
      }
    } catch {
      // Se falhar por qualquer restrição de ambiente, segue para o fallback vetorial
    } finally {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignora limpeza de temp
      }
    }
  }

  // Fallback determinístico em PDF vetorial
  try {
    const fallbackBuf = generateFallbackVectorPdfBuffer(markdownContent);
    await fs.writeFile(outputPdfPath, fallbackBuf);
    return {
      success: true,
      outputPdfPath,
      engine: "fallback-vector-pdf",
      sizeBytes: fallbackBuf.byteLength,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      outputPdfPath,
      engine: "fallback-vector-pdf",
      sizeBytes: 0,
      error: msg,
    };
  }
}
