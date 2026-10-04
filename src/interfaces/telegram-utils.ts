/**
 * Utilitários para a interface do Telegram do Benito
 */

/**
 * Verifica se um ID de usuário do Telegram está autorizado na whitelist.
 */
export function isUserAuthorized(
  userId: number | undefined,
  allowedIds: number[]
): boolean {
  if (userId === undefined || allowedIds.length === 0) {
    return false;
  }
  return allowedIds.includes(userId);
}

/**
 * Formata um feedback amigável para chamadas de ferramentas durante o streaming.
 */
export function formatToolFeedback(
  toolName: string,
  args: Record<string, unknown>
): string {
  switch (toolName) {
    case "search_web": {
      const q = typeof args.query === "string" ? args.query : "";
      return `🌐 Buscando na web: "${q}"...`;
    }
    case "fetch_web_page": {
      const url = typeof args.url === "string" ? args.url : "";
      return `📄 Lendo página: ${url.slice(0, 60)}...`;
    }
    case "save_memory": {
      const fact = typeof args.fact === "string" ? args.fact : "";
      return `🧠 Gravando memória: "${fact}"...`;
    }
    case "save_learning": {
      const lesson = typeof args.lesson === "string" ? args.lesson : "";
      return `💡 Registrando aprendizado: "${lesson}"...`;
    }
    case "read_topic_memory": {
      const topic = typeof args.topicSlug === "string" ? args.topicSlug : "";
      return `📂 Consultando tópico: "${topic}"...`;
    }
    case "save_topic_learning": {
      const topic = typeof args.topicSlug === "string" ? args.topicSlug : "";
      return `💡 Gravando no tópico "${topic}"...`;
    }
    case "write_file": {
      const fp = typeof args.filePath === "string" ? args.filePath : "";
      return `📁 Criando nota/arquivo: ${fp}...`;
    }
    case "read_file": {
      const fp = typeof args.filePath === "string" ? args.filePath : "";
      return `📖 Lendo arquivo: ${fp}...`;
    }
    default:
      return `⚙️ Executando: ${toolName}...`;
  }
}

/**
 * Divide uma mensagem longa em partes menores que o limite do Telegram (4096 caracteres).
 * Tenta quebrar em quebras de linha duplas (\n\n), simples (\n) ou espaços.
 */
export function splitTelegramMessage(
  text: string,
  maxLength: number = 4000
): string[] {
  if (!text || text.length <= maxLength) {
    return [text || ""];
  }

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    let chunk = remaining.slice(0, maxLength);
    let splitIndex = -1;

    // Procura por parágrafo
    const lastDoubleNewline = chunk.lastIndexOf("\n\n");
    if (lastDoubleNewline > maxLength * 0.4) {
      splitIndex = lastDoubleNewline + 2;
    } else {
      // Procura por quebra de linha simples
      const lastNewline = chunk.lastIndexOf("\n");
      if (lastNewline > maxLength * 0.4) {
        splitIndex = lastNewline + 1;
      } else {
        // Procura por espaço
        const lastSpace = chunk.lastIndexOf(" ");
        if (lastSpace > maxLength * 0.4) {
          splitIndex = lastSpace + 1;
        } else {
          // Hard cut
          splitIndex = maxLength;
        }
      }
    }

    parts.push(remaining.slice(0, splitIndex).trimEnd());
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return parts.filter((p) => p.length > 0);
}
