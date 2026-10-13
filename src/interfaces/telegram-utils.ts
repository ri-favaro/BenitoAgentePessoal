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
    case "record_expense": {
      const amount = typeof args.amount === "number" ? `R$ ${args.amount.toFixed(2)}` : "";
      const desc = typeof args.description === "string" ? ` (${args.description})` : "";
      return `💸 Registrando despesa: ${amount}${desc}...`;
    }
    case "record_income": {
      const amount = typeof args.amount === "number" ? `R$ ${args.amount.toFixed(2)}` : "";
      const desc = typeof args.description === "string" ? ` (${args.description})` : "";
      return `💰 Registrando receita: ${amount}${desc}...`;
    }
    case "cancel_last_transaction": {
      return `↩️ Cancelando lançamento financeiro anterior...`;
    }
    case "adjust_wallet_balance": {
      const w = typeof args.wallet === "string" ? args.wallet : "carteira";
      const amt = typeof args.newBalance === "number" ? ` para R$ ${args.newBalance.toFixed(2)}` : "";
      return `⚖️ Ajustando saldo da carteira [${w}]${amt}...`;
    }
    case "get_financial_summary": {
      return `📊 Consultando extrato financeiro no Obsidian...`;
    }
    case "search_codebase": {
      const q = typeof args.query === "string" ? args.query : "";
      const p = typeof args.project === "string" ? ` [${args.project}]` : "";
      return `🔍 Buscando no código${p}: "${q}"...`;
    }
    case "search_vault": {
      const q = typeof args.query === "string" ? args.query : "";
      return `📓 Buscando no Obsidian: "${q}"...`;
    }
    case "reindex_knowledge": {
      const t = typeof args.target === "string" ? args.target : "all";
      return `⚙️ Reindexando base de conhecimento (${t})...`;
    }
    case "run_self_audit": {
      return `🛡️ Executando auto-auditoria do sistema...`;
    }
    case "append_daily_note": {
      const s = typeof args.section === "string" ? ` [${args.section}]` : "";
      return `📅 Registrando na Daily Note${s}...`;
    }
    case "get_daily_note": {
      return `📅 Consultando Daily Note...`;
    }
    case "list_vault_tasks": {
      return `📋 Escaneando tarefas e checkboxes no cofre...`;
    }
    case "toggle_vault_task": {
      const c = args.completed ? "concluída" : "reaberta";
      return `☑️ Marcando tarefa como ${c}...`;
    }
    case "suggest_vault_links": {
      return `🔗 Mapeando conexões semânticas com o cofre...`;
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

/**
 * Estado de uma sessão rastreada.
 */
export interface SessionState {
  lastInteractionAt: number;
}

/**
 * Gerenciador de tempo de inatividade (TTL) por sessão/chat do Telegram.
 * Previne confusão de contexto e inchaço de memória quando o usuário fica
 * muito tempo sem interagir com o bot.
 */
export class SessionTracker {
  private sessions = new Map<number, SessionState>();
  private timeoutMinutes: number;

  constructor(timeoutMinutes: number = 120) {
    this.timeoutMinutes = timeoutMinutes;
  }

  getTimeoutMinutes(): number {
    return this.timeoutMinutes;
  }

  setTimeoutMinutes(minutes: number): void {
    this.timeoutMinutes = minutes;
  }

  /**
   * Verifica se a sessão de um chat expirou por inatividade.
   * Retorna false se o timeout for <= 0 (desativado) ou se não houver histórico de interação.
   */
  isExpired(chatId: number, now: number = Date.now()): boolean {
    if (this.timeoutMinutes <= 0) {
      return false;
    }
    const session = this.sessions.get(chatId);
    if (!session) {
      return false;
    }
    const elapsedMinutes = (now - session.lastInteractionAt) / (1000 * 60);
    return elapsedMinutes >= this.timeoutMinutes;
  }

  /**
   * Retorna a quantidade de minutos desde a última interação, ou null caso a sessão seja nova.
   */
  getInactiveMinutes(chatId: number, now: number = Date.now()): number | null {
    const session = this.sessions.get(chatId);
    if (!session) {
      return null;
    }
    return Math.floor((now - session.lastInteractionAt) / (1000 * 60));
  }

  /**
   * Atualiza o timestamp de atividade da sessão para o momento atual.
   */
  updateActivity(chatId: number, now: number = Date.now()): void {
    this.sessions.set(chatId, { lastInteractionAt: now });
  }

  /**
   * Reseta/remove o rastreamento da sessão (ex: quando o usuário dá /limpar).
   */
  resetSession(chatId: number): void {
    this.sessions.delete(chatId);
  }

  /**
   * Limpa todas as sessões rastreadas.
   */
  clear(): void {
    this.sessions.clear();
  }
}

