import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createCalculatorTools } from "../src/tools/calculator-tools.js";

async function runCalculatorTests() {
  console.log("🧪 Iniciando suíte de testes da Calculadora (Python + TypeScript)...\n");

  const projectRoot = process.cwd();
  const calculadoraDir = path.resolve(projectRoot, "tools", "calculadora");

  // ==========================================
  // 1. Integridade dos Arquivos do Módulo
  // ==========================================
  console.log("1. Verificando integridade e existência dos arquivos do módulo...");
  const expectedFiles = [
    "calculator.py",
    "app.py",
    "templates/index.html",
    "static/style.css",
    "static/script.js",
    "requirements.txt",
    "README.md",
    "test_calculator.py",
  ];

  for (const relFile of expectedFiles) {
    const fullPath = path.join(calculadoraDir, relFile);
    const stats = await fs.stat(fullPath);
    assert.ok(stats.isFile(), `Arquivo obrigatório ausente: ${relFile}`);
    assert.ok(stats.size > 0, `Arquivo está vazio: ${relFile}`);
  }
  console.log("✔ Todos os 8 arquivos estruturais da calculadora estão presentes e válidos!");

  // ==========================================
  // 2. Testes da Tool TypeScript do Benito (calculate)
  // ==========================================
  console.log("\n2. Testando ferramenta TypeScript 'calculate'...");
  const tools = createCalculatorTools();

  // 2.1 Adição
  const addRes: any = await tools.calculate.execute({
    operation: "add",
    a: 25,
    b: 17,
  });
  assert.strictEqual(addRes.success, true);
  assert.strictEqual(addRes.result, 42);
  assert.strictEqual(addRes.expression, "25 + 17 = 42");

  // 2.2 Subtração
  const subRes: any = await tools.calculate.execute({
    operation: "subtract",
    a: 100,
    b: 37,
  });
  assert.strictEqual(subRes.success, true);
  assert.strictEqual(subRes.result, 63);

  // 2.3 Multiplicação
  const multRes: any = await tools.calculate.execute({
    operation: "multiply",
    a: 8,
    b: 9,
  });
  assert.strictEqual(multRes.success, true);
  assert.strictEqual(multRes.result, 72);

  // 2.4 Divisão
  const divRes: any = await tools.calculate.execute({
    operation: "divide",
    a: 100,
    b: 8,
  });
  assert.strictEqual(divRes.success, true);
  assert.strictEqual(divRes.result, 12.5);

  // 2.5 Divisão por Zero
  const zeroDivRes: any = await tools.calculate.execute({
    operation: "divide",
    a: 50,
    b: 0,
  });
  assert.strictEqual(zeroDivRes.success, false);
  assert.strictEqual(zeroDivRes.code, "DIVISION_BY_ZERO");
  assert.ok(zeroDivRes.error.includes("Divisão por zero não é permitida"));

  // 2.6 Precisão de Ponto Flutuante (0.1 + 0.2)
  const floatRes: any = await tools.calculate.execute({
    operation: "add",
    a: 0.1,
    b: 0.2,
  });
  assert.strictEqual(floatRes.success, true);
  assert.strictEqual(floatRes.result, 0.3);

  // 2.7 Números Negativos
  const negRes: any = await tools.calculate.execute({
    operation: "add",
    a: -15,
    b: -35,
  });
  assert.strictEqual(negRes.success, true);
  assert.strictEqual(negRes.result, -50);

  console.log("✔ Operações básicas e tratamento de erros validados com 100% de precisão!");

  // ==========================================
  // 3. Testando tool get_calculator_status
  // ==========================================
  console.log("\n3. Testando tool 'get_calculator_status'...");
  const statusRes: any = await tools.get_calculator_status.execute({});
  assert.strictEqual(statusRes.success, true);
  assert.ok(
    statusRes.status === "online" || statusRes.status === "offline",
    "Status deve ser 'online' ou 'offline'"
  );
  assert.ok(statusRes.url.includes("5050"));
  console.log(`✔ Tool get_calculator_status respondeu com status: ${statusRes.status}`);

  // ==========================================
  // 4. Execução da Suíte Completa em Python
  // ==========================================
  console.log("\n4. Disparando suíte de testes unitários em Python (test_calculator.py)...");
  const pyRun = spawnSync("py", ["tools/calculadora/test_calculator.py"], {
    cwd: projectRoot,
    encoding: "utf-8",
  });

  const output = ((pyRun.stdout || "") + "\n" + (pyRun.stderr || "")).trim();
  console.log(output);

  assert.strictEqual(
    pyRun.status,
    0,
    `Processo Python falhou com código de saída ${pyRun.status}: ${output}`
  );
  assert.ok(output.includes("OK"), "Suíte em Python deve finalizar com OK");
  console.log("✔ Suíte de testes Python (Calculator + Flask API) passou com 100% de sucesso!");

  console.log("\n🎉 Todos os testes da Calculadora passaram com maestria!");
}

runCalculatorTests().catch((err) => {
  console.error("✖ Falha na suíte da calculadora:", err);
  process.exit(1);
});
