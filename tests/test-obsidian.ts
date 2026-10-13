import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import {
  createObsidianTools,
  buildInitialDailyNoteContent,
  insertContentIntoSection,
} from "../src/tools/obsidian-tools.js";

async function runObsidianTests() {
  console.log(pc.bold(pc.cyan("\n=== TESTES DO MÓDULO OBSIDIAN SECOND BRAIN (ISSUE #17) ===\n")));

  const tempVaultDir = path.resolve(process.cwd(), "tests", "temp-vault");
  const tempDailyDir = path.join(tempVaultDir, "Daily Notes");
  const allowedDirs = [process.cwd(), tempVaultDir];

  // Limpeza de testes anteriores
  await fs.rm(tempVaultDir, { recursive: true, force: true });
  await fs.mkdir(tempDailyDir, { recursive: true });

  const tools = createObsidianTools(tempVaultDir, tempDailyDir, allowedDirs);

  try {
    // ==========================================
    // 1. Testando buildInitialDailyNoteContent
    // ==========================================
    console.log(pc.yellow("1. Testando geração de template inicial de Daily Note..."));
    const template = buildInitialDailyNoteContent("2026-10-12");
    assert.ok(template.includes("## 📝 Notas & Decisões"));
    assert.ok(template.includes("## ✅ Tarefas & Pendências"));
    assert.ok(template.includes("## 💰 Finanças & Gastos"));
    assert.ok(template.includes("## 💡 Aprendizados & Insights"));
    assert.ok(template.includes("2026-10-12"));
    console.log(pc.green("✔ Template inicial de Daily Note gerado com sucesso!"));

    // ==========================================
    // 2. Testando insertContentIntoSection isolado
    // ==========================================
    console.log(pc.yellow("\n2. Testando insertContentIntoSection com seções múltiplas..."));
    let doc = template;
    doc = insertContentIntoSection(doc, "notas", "• Decisão arquitetural de usar LanceDB");
    doc = insertContentIntoSection(doc, "tarefas", "- [ ] Configurar CI/CD no GitHub");
    doc = insertContentIntoSection(doc, "aprendizados", "• MRL reduz dimensionalidade sem perder precisão");

    assert.ok(doc.includes("Decisão arquitetural de usar LanceDB"));
    assert.ok(doc.includes("- [ ] Configurar CI/CD no GitHub"));
    assert.ok(doc.includes("MRL reduz dimensionalidade"));
    // A ordem das seções deve ser preservada
    const idxNotas = doc.indexOf("## 📝 Notas & Decisões");
    const idxTarefas = doc.indexOf("## ✅ Tarefas & Pendências");
    const idxFinancas = doc.indexOf("## 💰 Finanças & Gastos");
    const idxAprendizados = doc.indexOf("## 💡 Aprendizados & Insights");
    assert.ok(idxNotas < idxTarefas);
    assert.ok(idxTarefas < idxFinancas);
    assert.ok(idxFinancas < idxAprendizados);
    console.log(pc.green("✔ Inserção em seções preservou integridade estrutural do Markdown!"));

    // ==========================================
    // 3. Testando append_daily_note criando arquivo real
    // ==========================================
    console.log(pc.yellow("\n3. Testando ferramenta append_daily_note (criação e múltiplos appends)..."));
    const appendRes1: any = await tools.append_daily_note.execute(
      { content: "Reunião de alinhamento com Luiz Ricardo", section: "notas", date: "2026-10-12" },
      { messages: [], toolCallId: "test-1" }
    );
    assert.strictEqual(appendRes1.success, true);
    assert.strictEqual(appendRes1.created, true);

    const appendRes2: any = await tools.append_daily_note.execute(
      { content: "Estudar arquitetura hexagonal", section: "tarefas", date: "2026-10-12" },
      { messages: [], toolCallId: "test-2" }
    );
    assert.strictEqual(appendRes2.success, true);
    assert.strictEqual(appendRes2.created, false);

    const appendRes3: any = await tools.append_daily_note.execute(
      { content: "Almoço de negócios R$ 45,00", section: "financas", date: "2026-10-12" },
      { messages: [], toolCallId: "test-3" }
    );
    assert.strictEqual(appendRes3.success, true);

    console.log(pc.green("✔ append_daily_note registrou notas, tarefas e finanças atomicamente!"));

    // ==========================================
    // 4. Testando get_daily_note
    // ==========================================
    console.log(pc.yellow("\n4. Testando get_daily_note (leitura e inexistência)..."));
    const getRes: any = await tools.get_daily_note.execute(
      { date: "2026-10-12" },
      { messages: [], toolCallId: "test-4" }
    );
    assert.strictEqual(getRes.success, true);
    assert.strictEqual(getRes.exists, true);
    assert.ok(getRes.content.includes("Reunião de alinhamento"));
    assert.ok(getRes.content.includes("- [ ] Estudar arquitetura hexagonal"));

    const getInexistente: any = await tools.get_daily_note.execute(
      { date: "2020-01-01" },
      { messages: [], toolCallId: "test-5" }
    );
    assert.strictEqual(getInexistente.success, true);
    assert.strictEqual(getInexistente.exists, false);
    console.log(pc.green("✔ get_daily_note validado com sucesso!"));

    // ==========================================
    // 5. Testando list_vault_tasks (abertas, concluídas e filtros)
    // ==========================================
    console.log(pc.yellow("\n5. Testando list_vault_tasks..."));
    // Cria uma segunda nota com tarefas mistas
    const extraNotePath = path.join(tempVaultDir, "Projeto Alfa.md");
    await fs.writeFile(
      extraNotePath,
      "# Projeto Alfa\n\n- [ ] Criar documentação técnica\n- [x] Configurar repositório git\n- [ ] Desenvolver MVP\n",
      "utf-8"
    );

    const openTasks: any = await tools.list_vault_tasks.execute(
      { status: "open" },
      { messages: [], toolCallId: "test-6" }
    );
    assert.strictEqual(openTasks.success, true);
    assert.ok(openTasks.totalFound >= 3);
    assert.ok(openTasks.tasks.some((t: any) => t.text.includes("Estudar arquitetura hexagonal")));
    assert.ok(openTasks.tasks.some((t: any) => t.text.includes("Criar documentação técnica")));
    assert.ok(openTasks.tasks.every((t: any) => t.status === "open"));

    const completedTasks: any = await tools.list_vault_tasks.execute(
      { status: "completed" },
      { messages: [], toolCallId: "test-7" }
    );
    assert.strictEqual(completedTasks.success, true);
    assert.strictEqual(completedTasks.tasks.length, 1);
    assert.ok(completedTasks.tasks[0].text.includes("Configurar repositório git"));
    assert.strictEqual(completedTasks.tasks[0].status, "completed");

    console.log(pc.green("✔ list_vault_tasks escaneou e filtrou checkboxes com precisão!"));

    // ==========================================
    // 6. Testando toggle_vault_task (concluir e reabrir)
    // ==========================================
    console.log(pc.yellow("\n6. Testando toggle_vault_task..."));
    const toggleRes: any = await tools.toggle_vault_task.execute(
      {
        filePath: "Projeto Alfa.md",
        taskText: "Criar documentação técnica",
        completed: true,
      },
      { messages: [], toolCallId: "test-8" }
    );
    assert.strictEqual(toggleRes.success, true);
    assert.strictEqual(toggleRes.completed, true);
    assert.ok(toggleRes.updatedLine.includes("- [x]"));

    // Verifica que agora a tarefa está marcada no disco
    const updatedExtra = await fs.readFile(extraNotePath, "utf-8");
    assert.ok(updatedExtra.includes("- [x] Criar documentação técnica"));

    // Reabre a tarefa
    const reopenRes: any = await tools.toggle_vault_task.execute(
      {
        filePath: "Projeto Alfa.md",
        taskText: "Criar documentação técnica",
        completed: false,
      },
      { messages: [], toolCallId: "test-9" }
    );
    assert.strictEqual(reopenRes.success, true);
    assert.strictEqual(reopenRes.completed, false);
    assert.ok(reopenRes.updatedLine.includes("- [ ]"));

    console.log(pc.green("✔ toggle_vault_task alternou status de tarefa de forma atômica no disco!"));

    // ==========================================
    // 7. Testando suggest_vault_links
    // ==========================================
    console.log(pc.yellow("\n7. Testando suggest_vault_links..."));
    // Cria notas conceituais no cofre
    await fs.writeFile(path.join(tempVaultDir, "Arquitetura de Software.md"), "# Arquitetura", "utf-8");
    await fs.writeFile(path.join(tempVaultDir, "TypeScript.md"), "# TypeScript", "utf-8");

    const sampleText = "No desenvolvimento moderno, aplicamos princípios de Arquitetura de Software e TypeScript no dia a dia.";
    const linkRes: any = await tools.suggest_vault_links.execute(
      { text: sampleText, autoInject: true },
      { messages: [], toolCallId: "test-10" }
    );
    assert.strictEqual(linkRes.success, true);
    assert.ok(linkRes.linksFound.includes("Arquitetura de Software"));
    assert.ok(linkRes.linksFound.includes("TypeScript"));
    assert.ok(linkRes.suggestedText.includes("[[Arquitetura de Software]]"));
    assert.ok(linkRes.suggestedText.includes("[[TypeScript]]"));
    console.log(pc.green("✔ suggest_vault_links identificou e injetou conexões [[WikiLinks]] perfeitamente!"));

    // ==========================================
    // 8. Testando Sandbox (Path Guard)
    // ==========================================
    console.log(pc.yellow("\n8. Testando proteção estrita de sandbox com path-guard..."));
    const evilFile = path.resolve("C:\\Windows\\System32\\evil.md");
    const sandboxedAppend: any = await tools.append_daily_note.execute(
      { content: "teste invasão", section: "notas", date: "evil" },
      { messages: [], toolCallId: "test-11" }
    );
    // append_daily_note constrói o path em dailyNotesDir que é seguro, mas toggle_vault_task aceita filePath direto:
    const sandboxedToggle: any = await tools.toggle_vault_task.execute(
      { filePath: evilFile, taskText: "evil", completed: true },
      { messages: [], toolCallId: "test-12" }
    );
    assert.strictEqual(sandboxedToggle.success, false);
    assert.ok(sandboxedToggle.error.includes("Acesso negado"));
    console.log(pc.green("✔ Sandbox bloqueou acessos fora do cofre com sucesso!"));

    console.log(pc.bold(pc.green("\n🎉 Todos os 8 testes do Second Brain (Obsidian) passaram com 100% de sucesso! 🚀\n")));
  } finally {
    // Limpeza após o teste
    await fs.rm(tempVaultDir, { recursive: true, force: true });
  }
}

runObsidianTests().catch((err) => {
  console.error(pc.red("Erro fatal no teste do Obsidian Second Brain:"), err);
  process.exit(1);
});
