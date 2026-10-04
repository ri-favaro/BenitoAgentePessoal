import path from "node:path";
import fs from "node:fs/promises";
import { isPathInside, validateAllowedPath } from "../src/tools/path-guard.js";
import { createFilesystemTools } from "../src/tools/filesystem-tools.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log("🧪 Iniciando testes de segurança do sistema de arquivos (Path Guard)...\n");

  const projectDir = process.cwd();
  const obsidianDir = "G:\\CofreObsidian\\AgentePessoal";
  const allowedDirs = [projectDir, obsidianDir];

  // 1. Testes unitários de isPathInside
  console.log("1. Testando isPathInside...");

  // Subdiretório e arquivos internos
  assert(
    isPathInside(projectDir, path.join(projectDir, "src", "tools", "index.ts")),
    "Arquivo interno do projeto deve ser permitido"
  );
  assert(
    isPathInside(obsidianDir, "G:\\CofreObsidian\\AgentePessoal\\Notas\\ideia.md"),
    "Arquivo dentro do cofre do Obsidian deve ser permitido"
  );
  assert(
    isPathInside(projectDir, projectDir),
    "O próprio diretório pai deve ser considerado contido nele mesmo"
  );

  // Tentativa de path traversal
  assert(
    !isPathInside(projectDir, path.join(projectDir, "..", "outro-projeto", "segredo.env")),
    "Tentativa de path traversal com '..' para fora do projeto deve ser bloqueada"
  );
  assert(
    !isPathInside(obsidianDir, "G:\\CofreObsidian\\OutroCofrePrivado\\nota.md"),
    "Pasta irmã fora de AgentePessoal deve ser bloqueada"
  );
  assert(
    !isPathInside(obsidianDir, "G:\\CofreObsidian\\AgentePessoalFake\\nota.md"),
    "Pasta com prefixo similar deve ser bloqueada"
  );

  // Unidade diferente (cross-drive)
  assert(
    !isPathInside("G:\\Projetos", "C:\\Windows\\System32\\calc.exe"),
    "Arquivo em outra unidade de disco (C: vs G:) deve ser bloqueado"
  );

  // Case-insensitivity no Windows
  assert(
    isPathInside("g:\\cofreobsidian\\agentepessoal", "G:\\COFREOBSIDIAN\\AgentePessoal\\nota.md"),
    "Diferenças de maiúsculas/minúsculas no Windows devem ser tratadas corretamente"
  );

  console.log("✔ Testes de isPathInside passaram com sucesso.\n");

  // 2. Testes de validateAllowedPath
  console.log("2. Testando validateAllowedPath...");

  const validRes = validateAllowedPath("src/config.ts", allowedDirs);
  assert(validRes.allowed === true, "Caminho relativo dentro do projeto deve ser permitido");
  assert(
    validRes.resolvedPath === path.resolve("src/config.ts"),
    "Deve retornar o caminho absoluto resolvido"
  );

  const invalidRes = validateAllowedPath("C:\\Windows\\System32\\cmd.exe", allowedDirs);
  assert(invalidRes.allowed === false, "Caminho fora das pastas autorizadas deve ser negado");
  assert(
    typeof invalidRes.error === "string" && invalidRes.error.includes("Acesso negado"),
    "Deve conter mensagem de erro clara informando 'Acesso negado'"
  );

  console.log("✔ Testes de validateAllowedPath passaram com sucesso.\n");

  // 3. Testes de integração com as ferramentas (createFilesystemTools)
  console.log("3. Testando ferramentas de sistema de arquivos...");
  const fsTools = createFilesystemTools(allowedDirs);

  // 3.1 Escrita e leitura autorizada dentro do projeto
  const tempTestFile = path.join(projectDir, "tests", "temp_sandbox_test.txt");
  const testContent = "Teste de escrita em diretório autorizado pelo Benito!";

  try {
    const writeResult: any = await (fsTools.write_file as any).execute({
      filePath: tempTestFile,
      content: testContent,
    });
    assert(writeResult.success === true, "write_file em local permitido deve ter sucesso");

    const readResult: any = await (fsTools.read_file as any).execute({
      filePath: tempTestFile,
    });
    assert(readResult.success === true, "read_file em local permitido deve ter sucesso");
    assert(readResult.content === testContent, "Conteúdo lido deve ser idêntico ao escrito");

    const listResult: any = await (fsTools.list_directory as any).execute({
      dirPath: path.join(projectDir, "tests"),
    });
    assert(listResult.success === true, "list_directory em pasta permitida deve ter sucesso");
    assert(
      listResult.items.some((item: any) => item.name === "temp_sandbox_test.txt"),
      "list_directory deve listar o arquivo recém-criado"
    );
  } finally {
    // Limpeza
    try {
      await fs.unlink(tempTestFile);
    } catch {}
  }

  // 3.2 Tentativas bloqueadas fora dos diretórios permitidos
  const blockedFile = "C:\\Windows\\Temp\\arquivo_malicioso_teste.txt";

  const blockedWrite: any = await (fsTools.write_file as any).execute({
    filePath: blockedFile,
    content: "Não deveria escrever aqui!",
  });
  assert(blockedWrite.success === false, "write_file em pasta não permitida DEVE falhar");
  assert(
    blockedWrite.error.includes("Acesso negado"),
    "write_file bloqueado deve retornar erro de acesso negado"
  );

  const blockedRead: any = await (fsTools.read_file as any).execute({
    filePath: "C:\\Windows\\System32\\drivers\\etc\\hosts",
  });
  assert(blockedRead.success === false, "read_file em pasta não permitida DEVE falhar");
  assert(
    blockedRead.error.includes("Acesso negado"),
    "read_file bloqueado deve retornar erro de acesso negado"
  );

  const blockedList: any = await (fsTools.list_directory as any).execute({
    dirPath: "C:\\Windows",
  });
  assert(blockedList.success === false, "list_directory em pasta não permitida DEVE falhar");
  assert(
    blockedList.error.includes("Acesso negado"),
    "list_directory bloqueado deve retornar erro de acesso negado"
  );

  console.log("✔ Testes de ferramentas com trava de segurança passaram com sucesso!\n");
  console.log("🎉 Todos os testes de segurança do sistema de arquivos passaram!");
}

runTests().catch((err) => {
  console.error("❌ Erro inesperado nos testes:", err);
  process.exit(1);
});
