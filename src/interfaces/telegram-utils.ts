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
    case "create_github_issue": {
      const t = typeof args.title === "string" ? args.title : "";
      return `🐙 Criando issue no GitHub: "${t}"...`;
    }
    case "list_github_issues": {
      return `🐙 Consultando issues no GitHub...`;
    }
    case "get_github_issue": {
      const num = typeof args.issueNumber === "number" ? `#${args.issueNumber}` : "";
      return `🐙 Consultando detalhes da issue ${num}...`;
    }
    case "create_github_pr": {
      const t = typeof args.title === "string" ? args.title : "";
      return `🐙 Abrindo Pull Request no GitHub: "${t}"...`;
    }
    case "list_github_prs": {
      return `🐙 Listando Pull Requests no GitHub...`;
    }
    case "get_github_pr": {
      const num = typeof args.prNumber === "number" ? `#${args.prNumber}` : "";
      return `🐙 Consultando detalhes do Pull Request ${num}...`;
    }
    case "summarize_merged_prs": {
      return `📊 Gerando resumo executivo de PRs mergeados...`;
    }
    case "summarize_github_pr": {
      const num = typeof args.prNumber === "number" ? `#${args.prNumber}` : "";
      return `🐙 Analisando Pull Request ${num} e impacto arquitetural...`;
    }
    case "execute_workspace_command": {
      const c = typeof args.command === "string" ? args.command : "";
      return `⚡ Executando comando no workspace: ${c}...`;
    }
    case "prepare_coding_task": {
      const num = typeof args.issueNumber === "number" ? `#${args.issueNumber}` : "";
      return `📦 Empacotando contexto da issue ${num} para o AGY CLI...`;
    }
    case "delegate_issue_to_coding_agent": {
      const num = typeof args.issueNumber === "number" ? `#${args.issueNumber}` : "";
      const isDry = args.dryRun ? " (simulação)" : " (executando com AGY CLI - aguarde...)";
      return `🤖 Delegando issue ${num} para coding agent${isDry}...`;
    }
    case "analyze_job_posting": {
      const comp = typeof args.company === "string" ? args.company : "vaga";
      return `💼 Analisando aderência de vaga para Pleno [${comp}]...`;
    }
    case "generate_tailored_application": {
      const comp = typeof args.company === "string" ? args.company : "vaga";
      return `📄 Gerando currículo adaptado (.md + .pdf) e pitch [${comp}]...`;
    }
    case "export_resume_pdf": {
      const comp = typeof args.company === "string" ? args.company : "currículo";
      return `📄 Exportando currículo atualizado em PDF [${comp}]...`;
    }
    case "_old_generate_tailored": {
      const comp = typeof args.company === "string" ? args.company : "vaga";
      return `📄 Gerando currículo adaptado e pitch de abordagem [${comp}]...`;
    }
    case "generate_career_report": {
      return `📊 Consolidando gaps de mercado e observatório de carreira...`;
    }
    case "update_job_application_status": {
      const comp = typeof args.company === "string" ? args.company : (typeof args.jobId === "string" ? args.jobId : "vaga");
      const st = typeof args.status === "string" ? args.status.toUpperCase() : "status";
      return `💼 Atualizando status da candidatura [${comp}] para ${st}...`;
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

/**
 * Extrai o tempo de espera (retry_after em segundos) de um erro do Telegram (ex: HTTP 429).
 * Suporta grammY Error (error.parameters.retry_after) ou regex no message: "retry after (\d+)".
 */
export function parseTelegramRetryAfter(err: unknown): number | null {
  if (!err) return null;

  // Checa parameters.retry_after (nativo do grammY / Bot API)
  if (typeof err === "object" && err !== null) {
    const params = (err as any).parameters;
    if (params && typeof params.retry_after === "number" && params.retry_after > 0) {
      return params.retry_after;
    }
  }

  // Fallback via regex na mensagem de erro
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/retry after (\d+)/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (!Number.isNaN(val) && val > 0) {
      return val;
    }
  }

  // Se o erro menciona 429 / Too Many Requests mas sem número explícito
  if (message.includes("429") || message.toLowerCase().includes("too many requests")) {
    return 30; // Cooldown defensivo padrão de 30 segundos
  }

  return null;
}

/**
 * Gerenciador de Rate Limit / Flood Wait para o Telegram Bot.
 * Mantém o registro de cooldowns ativos por chat ou globais para evitar
 * bombardeio repetido da API do Telegram após receber 429.
 */
export class TelegramRateLimiter {
  private chatCooldowns = new Map<number, number>();
  private globalCooldownUntil = 0;

  /**
   * Define um período de cooldown para um chat específico em segundos.
   */
  setChatCooldown(chatId: number, seconds: number, now: number = Date.now()): void {
    this.chatCooldowns.set(chatId, now + seconds * 1000);
  }

  /**
   * Define um período de cooldown global em segundos.
   */
  setGlobalCooldown(seconds: number, now: number = Date.now()): void {
    this.globalCooldownUntil = now + seconds * 1000;
  }

  /**
   * Verifica se o chat especificado ou o bot globalmente está em cooldown de edição/requisição.
   */
  isRateLimited(chatId: number, now: number = Date.now()): boolean {
    if (this.globalCooldownUntil > now) {
      return true;
    }
    const chatUntil = this.chatCooldowns.get(chatId);
    if (chatUntil && chatUntil > now) {
      return true;
    }
    return false;
  }

  /**
   * Retorna os segundos restantes de cooldown para um chat (0 se não estiver limitado).
   */
  getRemainingSeconds(chatId: number, now: number = Date.now()): number {
    const chatUntil = this.chatCooldowns.get(chatId) || 0;
    const targetUntil = Math.max(chatUntil, this.globalCooldownUntil);
    if (targetUntil <= now) return 0;
    return Math.ceil((targetUntil - now) / 1000);
  }

  /**
   * Reseta o cooldown para um chat.
   */
  clearChat(chatId: number): void {
    this.chatCooldowns.delete(chatId);
  }

  /**
   * Limpa todos os cooldowns registrados.
   */
  clearAll(): void {
    this.chatCooldowns.clear();
    this.globalCooldownUntil = 0;
  }
}


