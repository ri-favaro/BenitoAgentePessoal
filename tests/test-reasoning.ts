import pc from "picocolors";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ReasoningStreamParser,
  stripThinking,
  extractThinking,
} from "../src/core/reasoning-parser.js";
import { logReasoningAudit } from "../src/core/reasoning-logger.js";
import { MemoryManager } from "../src/memory/memory-manager.js";

async function runTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTES DE DECOUPLED REASONING & INTENT EXPANSION ===")));

  // 1. Testando ReasoningStreamParser em bloco único
  console.log(pc.yellow("\n1. Testando ReasoningStreamParser (bloco único)..."));
  {
    const thoughtChunks: string[] = [];
    const responseChunks: string[] = [];
    let completedThought = "";

    const parser = new ReasoningStreamParser({
      onThoughtChunk: (chunk) => thoughtChunks.push(chunk),
      onResponseChunk: (chunk) => responseChunks.push(chunk),
      onThoughtCompleted: (thought) => {
        completedThought = thought;
      },
    });

    parser.processChunk("<thinking>1. Intenção: saudar o usuário\n2. Plano: direto</thinking>Olá, Luiz Ricardo!");
    const result = parser.finish();

    if (
      result.thought === "1. Intenção: saudar o usuário\n2. Plano: direto" &&
      result.cleanResponse === "Olá, Luiz Ricardo!" &&
      completedThought === "1. Intenção: saudar o usuário\n2. Plano: direto" &&
      responseChunks.join("") === "Olá, Luiz Ricardo!"
    ) {
      console.log(pc.green("✔ Bloco único processado e separado com sucesso!"));
    } else {
      console.error(pc.red("✖ Falha no bloco único:"), { result, completedThought });
      process.exit(1);
    }
  }

  // 2. Testando tokens fragmentados (streaming picado)
  console.log(pc.yellow("\n2. Testando tokens fragmentados (streaming fracionado)..."));
  {
    const thoughtChunks: string[] = [];
    const responseChunks: string[] = [];

    const parser = new ReasoningStreamParser({
      onThoughtChunk: (chunk) => thoughtChunks.push(chunk),
      onResponseChunk: (chunk) => responseChunks.push(chunk),
    });

    const fragmentedStream = [
      "<th",
      "inking>",
      "1. Intenção: ",
      "Gasto com almoço\n",
      "2. Regras: ",
      "Carteira VA\n",
      "3. Plano: ",
      "record_expense",
      "</think",
      "ing>",
      "Gasto de R$ 35,00 ",
      "registrado com sucesso ",
      "no Vale Alimentação!",
    ];

    for (const chunk of fragmentedStream) {
      parser.processChunk(chunk);
    }
    const result = parser.finish();

    const expectedThought =
      "1. Intenção: Gasto com almoço\n2. Regras: Carteira VA\n3. Plano: record_expense";
    const expectedResponse =
      "Gasto de R$ 35,00 registrado com sucesso no Vale Alimentação!";

    if (
      result.thought === expectedThought &&
      result.cleanResponse === expectedResponse &&
      responseChunks.join("") === expectedResponse
    ) {
      console.log(pc.green("✔ Chunks fragmentados reconstituídos sem vazamento de tags!"));
    } else {
      console.error(pc.red("✖ Falha na reconstituição fragmentada:"), {
        actualThought: result.thought,
        expectedThought,
        actualResponse: result.cleanResponse,
        expectedResponse,
      });
      process.exit(1);
    }
  }

  // 3. Testando múltiplos blocos de pensamento (multi-step tool calls)
  console.log(pc.yellow("\n3. Testando múltiplos blocos de pensamento (multi-step)..."));
  {
    const parser = new ReasoningStreamParser();
    parser.processChunk("<thinking>Passo 1: verificar saldo</thinking>");
    parser.processChunk("Consultando saldo...\n");
    parser.processChunk("<thinking>Passo 2: registrar débito</thinking>");
    parser.processChunk("Débito concluído!");

    const result = parser.finish();
    if (
      result.thought === "Passo 1: verificar saldo\n\nPasso 2: registrar débito" &&
      result.cleanResponse === "Consultando saldo...\nDébito concluído!"
    ) {
      console.log(pc.green("✔ Múltiplos passos acumulados e concatenados corretamente!"));
    } else {
      console.error(pc.red("✖ Falha nos múltiplos passos:"), result);
      process.exit(1);
    }
  }

  // 4. Testando tag não fechada (unclosed tag guard)
  console.log(pc.yellow("\n4. Testando recuperação de tag <thinking> não fechada..."));
  {
    const parser = new ReasoningStreamParser();
    parser.processChunk("<thinking>Planejando resposta mas o modelo foi interrompido");
    const result = parser.finish();

    if (
      result.thought === "Planejando resposta mas o modelo foi interrompido" &&
      result.cleanResponse === ""
    ) {
      console.log(pc.green("✔ Tag não fechada capturada com segurança no finish()!"));
    } else {
      console.error(pc.red("✖ Falha no unclosed tag:"), result);
      process.exit(1);
    }
  }

  // 5. Testando resposta direta (sem <thinking>)
  console.log(pc.yellow("\n5. Testando resposta direta sem scratchpad..."));
  {
    const parser = new ReasoningStreamParser();
    parser.processChunk("Bom dia! ");
    parser.processChunk("Como posso te ajudar hoje?");
    const result = parser.finish();

    if (
      result.thought === "" &&
      result.cleanResponse === "Bom dia! Como posso te ajudar hoje?"
    ) {
      console.log(pc.green("✔ Resposta direta preservada integralmente!"));
    } else {
      console.error(pc.red("✖ Falha na resposta direta:"), result);
      process.exit(1);
    }
  }

  // 6. Testando stripThinking e extractThinking (com <thinking> e <think>)
  console.log(pc.yellow("\n6. Testando utilitários stripThinking e extractThinking..."));
  {
    const raw = "<thinking>planejamento interno</thinking>Resposta limpa e formatada.";
    const cleaned = stripThinking(raw);
    const extracted = extractThinking(raw);

    const rawThink = "<think>raciocínio nativo</think>Resposta nativa.";
    const cleanedThink = stripThinking(rawThink);
    const extractedThink = extractThinking(rawThink);

    const unclosedRaw = "<thinking>pensamento inacabado";
    const cleanedUnclosed = stripThinking(unclosedRaw);

    if (
      cleaned === "Resposta limpa e formatada." &&
      extracted === "planejamento interno" &&
      cleanedThink === "Resposta nativa." &&
      extractedThink === "raciocínio nativo" &&
      cleanedUnclosed === ""
    ) {
      console.log(pc.green("✔ stripThinking e extractThinking validados com sucesso (<thinking> e <think>)!"));
    } else {
      console.error(pc.red("✖ Falha em stripThinking / extractThinking:"), {
        cleaned,
        extracted,
        cleanedThink,
        extractedThink,
        cleanedUnclosed,
      });
      process.exit(1);
    }
  }

  // 7. Testando gravação de auditoria em arquivo (ReasoningLogger)
  console.log(pc.yellow("\n7. Testando gravação de auditoria (logs/reasoning.log)..."));
  {
    const testLogFile = path.resolve(process.cwd(), "logs", "test-reasoning-audit.log");
    try {
      await fs.unlink(testLogFile);
    } catch {}

    const entry = {
      timestamp: new Date().toISOString(),
      userInput: "Comprei pão na padaria por 12 reais",
      thought: "1. Intenção: Gasto alimentar\n2. Regras: Carteira VA\n3. Plano: record_expense",
      cleanResponse: "Gasto de R$ 12,00 registrado com sucesso no Vale Alimentação!",
      durationMs: 450,
    };

    await logReasoningAudit(entry, testLogFile);

    const content = await fs.readFile(testLogFile, "utf-8");
    const parsed = JSON.parse(content.trim());

    if (
      parsed.userInput === entry.userInput &&
      parsed.thought === entry.thought &&
      parsed.cleanResponse === entry.cleanResponse &&
      parsed.durationMs === 450
    ) {
      console.log(pc.green("✔ Log de auditoria gravado no formato JSONL com fidelidade!"));
    } else {
      console.error(pc.red("✖ Falha no log de auditoria:"), parsed);
      process.exit(1);
    }

    await fs.unlink(testLogFile);
  }

  // 8. Testando injeção do protocolo no System Prompt
  console.log(pc.yellow("\n8. Testando inclusão do protocolo no buildSystemPrompt()..."));
  {
    const memory = new MemoryManager();
    const prompt = await memory.buildSystemPrompt();

    if (
      prompt.includes("# PROTOCOLO MESTRE: RACIOCÍNIO DESACOPLADO OBRIGATÓRIO") &&
      prompt.includes("<thinking>") &&
      prompt.includes("Intenção Real & Implícita") &&
      prompt.includes("Checagem de Regras & Ferramentas") &&
      prompt.includes("Plano de Execução")
    ) {
      console.log(pc.green("✔ Protocolo Mestre de Scratchpad devidamente injetado no topo do System Prompt!"));
    } else {
      console.error(pc.red("✖ System prompt não contém o protocolo esperado:"), prompt.slice(0, 400));
      process.exit(1);
    }
  }

  console.log(pc.bold(pc.green("\n🎉 Todos os testes de Decoupled Reasoning passaram com 100% de sucesso!\n")));
}

runTests().catch((err) => {
  console.error(pc.red("Erro fatal nos testes:"), err);
  process.exit(1);
});
