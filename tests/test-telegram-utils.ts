import {
  isUserAuthorized,
  splitTelegramMessage,
  formatToolFeedback,
} from "../src/interfaces/telegram-utils.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falha: ${message}`);
    process.exit(1);
  }
}

console.log("🧪 Iniciando testes de utilitários do Telegram...\n");

// 1. Testes de Whitelist
console.log("1. Testando isUserAuthorized...");
assert(isUserAuthorized(123456, [123456, 789012]), "Deveria autorizar usuário na whitelist");
assert(!isUserAuthorized(999999, [123456, 789012]), "Não deveria autorizar usuário fora da whitelist");
assert(!isUserAuthorized(undefined, [123456]), "Não deveria autorizar undefined");
assert(!isUserAuthorized(123456, []), "Não deveria autorizar se a whitelist estiver vazia");
console.log("✔ Testes de isUserAuthorized passaram com sucesso.");

// 2. Testes de Divisão de Mensagens (splitTelegramMessage)
console.log("\n2. Testando splitTelegramMessage...");
const shortText = "Olá, eu sou o Benito!";
const shortResult = splitTelegramMessage(shortText, 4000);
assert(shortResult.length === 1 && shortResult[0] === shortText, "Mensagem curta deve permanecer intacta");

// Cria um texto longo com mais de 7000 caracteres separado por parágrafos
const paragraph1 = "A".repeat(2500) + "\n\n";
const paragraph2 = "B".repeat(2500) + "\n\n";
const paragraph3 = "C".repeat(2500);
const longText = paragraph1 + paragraph2 + paragraph3;

const longResult = splitTelegramMessage(longText, 4000);
assert(longResult.length >= 2, "Texto longo (>7500 chars) deve ser dividido em 2 ou mais partes");
for (let i = 0; i < longResult.length; i++) {
  assert(
    longResult[i].length <= 4000,
    `Parte ${i + 1} excede o limite de 4000 caracteres (tamanho: ${longResult[i].length})`
  );
}
console.log(`✔ Texto longo de ${longText.length} caracteres dividido com sucesso em ${longResult.length} partes.`);

// 3. Testes de Feedback de Ferramentas
console.log("\n3. Testando formatToolFeedback...");
const searchFeedback = formatToolFeedback("search_web", { query: "notícias de IA" });
assert(searchFeedback.includes("notícias de IA"), "Deveria conter a query da busca");

const memoryFeedback = formatToolFeedback("save_memory", { fact: "Usuário gosta de café" });
assert(memoryFeedback.includes("Usuário gosta de café"), "Deveria conter o fato gravado");

const unknownFeedback = formatToolFeedback("custom_tool", {});
assert(unknownFeedback.includes("custom_tool"), "Deveria conter o nome da ferramenta desconhecida");
console.log("✔ Testes de formatToolFeedback passaram com sucesso.");

console.log("\n🎉 Todos os testes de utilitários do Telegram passaram com sucesso!");
