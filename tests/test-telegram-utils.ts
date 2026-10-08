import {
  isUserAuthorized,
  splitTelegramMessage,
  formatToolFeedback,
  SessionTracker,
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

// 4. Testes do SessionTracker (Expiração Automática por Inatividade - TTL)
console.log("\n4. Testando SessionTracker (TTL por Inatividade)...");
const tracker = new SessionTracker(120); // 120 minutos
const baseTime = 1000000000000;
const chatIdA = 111;
const chatIdB = 222;

// 4.1 Nova sessão sem histórico não deve estar expirada
assert(!tracker.isExpired(chatIdA, baseTime), "Nova sessão sem atividade não deve estar expirada");
assert(tracker.getInactiveMinutes(chatIdA, baseTime) === null, "Nova sessão deve retornar null de inatividade");

// 4.2 Registra primeira atividade no chat A
tracker.updateActivity(chatIdA, baseTime);
assert(tracker.getInactiveMinutes(chatIdA, baseTime) === 0, "Inatividade inicial deve ser 0 min");
assert(!tracker.isExpired(chatIdA, baseTime), "Sessão recém-iniciada não deve estar expirada");

// 4.3 Avança 60 minutos (dentro do prazo de 120 min)
const timeAfter60Min = baseTime + 60 * 60 * 1000;
assert(!tracker.isExpired(chatIdA, timeAfter60Min), "Sessão com 60min de inatividade não deve estar expirada");
assert(tracker.getInactiveMinutes(chatIdA, timeAfter60Min) === 60, "Deve indicar 60min de inatividade");

// 4.4 Avança para 121 minutos (passou o prazo de 120 min)
const timeAfter121Min = baseTime + 121 * 60 * 1000;
assert(tracker.isExpired(chatIdA, timeAfter121Min), "Sessão com 121min deve estar expirada");
assert(tracker.getInactiveMinutes(chatIdA, timeAfter121Min) === 121, "Deve indicar 121min de inatividade");

// 4.5 Renovação de atividade (updateActivity) renova o ciclo
tracker.updateActivity(chatIdA, timeAfter121Min);
assert(!tracker.isExpired(chatIdA, timeAfter121Min), "Após updateActivity, sessão não deve estar expirada");
assert(tracker.getInactiveMinutes(chatIdA, timeAfter121Min) === 0, "Inatividade deve voltar para 0 min");

// 4.6 Isolamento entre múltiplos chats
tracker.updateActivity(chatIdB, timeAfter121Min);
const timeAfter250Min = baseTime + 250 * 60 * 1000; // chat A inativo por 129 min, chat B inativo por 129 min
assert(tracker.isExpired(chatIdA, timeAfter250Min), "Chat A deve estar expirado");
tracker.updateActivity(chatIdB, timeAfter250Min); // Chat B reage
assert(!tracker.isExpired(chatIdB, timeAfter250Min), "Chat B reativo não deve estar expirado");

// 4.7 Reset de sessão (/limpar)
tracker.resetSession(chatIdA);
assert(!tracker.isExpired(chatIdA, timeAfter250Min), "Sessão resetada não deve constar como expirada");
assert(tracker.getInactiveMinutes(chatIdA, timeAfter250Min) === null, "Sessão resetada deve retornar null");

// 4.8 Desativação de TTL (timeout <= 0)
const disabledTracker = new SessionTracker(0);
disabledTracker.updateActivity(chatIdA, baseTime);
assert(!disabledTracker.isExpired(chatIdA, baseTime + 999999999), "Timeout 0 deve desativar expiração");
console.log("✔ Todos os cenários de SessionTracker validados com sucesso!");

console.log("\n🎉 Todos os testes de utilitários do Telegram passaram com 100% de sucesso!");

