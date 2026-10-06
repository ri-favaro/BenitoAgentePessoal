export interface ReasoningParserCallbacks {
  onThoughtChunk?: (chunk: string) => void;
  onResponseChunk?: (chunk: string) => void;
  onThoughtCompleted?: (thought: string) => void;
}

export class ReasoningStreamParser {
  private buffer = "";
  private inThought = false;
  private currentThought = "";
  private thoughts: string[] = [];
  private cleanResponses: string[] = [];

  private activeCloseTag = "</thinking>";

  private static readonly TAG_PAIRS = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<think>", close: "</think>" },
  ];

  constructor(private callbacks?: ReasoningParserCallbacks) {}

  public processChunk(chunk: string): void {
    if (!chunk) return;
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (!this.inThought) {
        // Estamos fora do bloco de pensamento. Procuramos qualquer tag de abertura (<thinking> ou <think>)
        let earliestOpenIdx = -1;
        let matchedPair = ReasoningStreamParser.TAG_PAIRS[0];

        const lowerBuf = this.buffer.toLowerCase();
        for (const pair of ReasoningStreamParser.TAG_PAIRS) {
          const idx = lowerBuf.indexOf(pair.open);
          if (idx !== -1 && (earliestOpenIdx === -1 || idx < earliestOpenIdx)) {
            earliestOpenIdx = idx;
            matchedPair = pair;
          }
        }

        if (earliestOpenIdx !== -1) {
          // Há texto de resposta antes da tag de abertura
          if (earliestOpenIdx > 0) {
            const responsePart = this.buffer.slice(0, earliestOpenIdx);
            this.cleanResponses.push(responsePart);
            this.callbacks?.onResponseChunk?.(responsePart);
          }

          // Entra no estado de pensamento
          this.inThought = true;
          this.activeCloseTag = matchedPair.close;
          this.currentThought = "";
          this.buffer = this.buffer.slice(earliestOpenIdx + matchedPair.open.length);
          continue;
        }

        // Verifica se o fim do buffer é um prefixo de alguma tag de abertura
        let maxPartialLen = 0;
        for (const pair of ReasoningStreamParser.TAG_PAIRS) {
          for (let i = 1; i < pair.open.length; i++) {
            if (pair.open.startsWith(lowerBuf.slice(-i))) {
              if (i > maxPartialLen) {
                maxPartialLen = i;
              }
            }
          }
        }

        if (maxPartialLen > 0) {
          const safeLen = this.buffer.length - maxPartialLen;
          if (safeLen > 0) {
            const responsePart = this.buffer.slice(0, safeLen);
            this.cleanResponses.push(responsePart);
            this.callbacks?.onResponseChunk?.(responsePart);
            this.buffer = this.buffer.slice(safeLen);
          }
          break;
        }

        // Nenhum prefixo detectado, todo o buffer é resposta limpa
        this.cleanResponses.push(this.buffer);
        this.callbacks?.onResponseChunk?.(this.buffer);
        this.buffer = "";
        break;
      } else {
        // Estamos dentro do bloco de pensamento. Procuramos o fechamento
        const lowerBuf = this.buffer.toLowerCase();
        const closeIdx = lowerBuf.indexOf(this.activeCloseTag);

        if (closeIdx !== -1) {
          const thoughtPart = this.buffer.slice(0, closeIdx);
          this.currentThought += thoughtPart;
          if (thoughtPart) {
            this.callbacks?.onThoughtChunk?.(thoughtPart);
          }

          const completed = this.currentThought.trim();
          if (completed) {
            this.thoughts.push(completed);
            this.callbacks?.onThoughtCompleted?.(completed);
          }

          this.inThought = false;
          this.currentThought = "";
          this.buffer = this.buffer.slice(closeIdx + this.activeCloseTag.length);
          continue;
        }

        // Verifica se o fim do buffer é um prefixo da tag de fechamento
        let partialPrefixLen = 0;
        for (let i = 1; i < this.activeCloseTag.length; i++) {
          if (this.activeCloseTag.startsWith(lowerBuf.slice(-i))) {
            partialPrefixLen = i;
            break;
          }
        }

        if (partialPrefixLen > 0) {
          const safeLen = this.buffer.length - partialPrefixLen;
          if (safeLen > 0) {
            const thoughtPart = this.buffer.slice(0, safeLen);
            this.currentThought += thoughtPart;
            this.callbacks?.onThoughtChunk?.(thoughtPart);
            this.buffer = this.buffer.slice(safeLen);
          }
          break;
        }

        // Nenhum prefixo detectado, todo o buffer é pensamento
        this.currentThought += this.buffer;
        this.callbacks?.onThoughtChunk?.(this.buffer);
        this.buffer = "";
        break;
      }
    }
  }

  public finish(): { thought: string; cleanResponse: string } {
    if (this.buffer.length > 0) {
      if (this.inThought) {
        this.currentThought += this.buffer;
        this.callbacks?.onThoughtChunk?.(this.buffer);
        const completed = this.currentThought.trim();
        if (completed) {
          this.thoughts.push(completed);
          this.callbacks?.onThoughtCompleted?.(completed);
        }
        this.inThought = false;
      } else {
        this.cleanResponses.push(this.buffer);
        this.callbacks?.onResponseChunk?.(this.buffer);
      }
      this.buffer = "";
    } else if (this.inThought && this.currentThought.trim()) {
      const completed = this.currentThought.trim();
      this.thoughts.push(completed);
      this.callbacks?.onThoughtCompleted?.(completed);
      this.inThought = false;
    }

    return {
      thought: this.thoughts.join("\n\n").trim(),
      cleanResponse: this.cleanResponses.join("").trim(),
    };
  }
}

/**
 * Remove qualquer ocorrência de tags <thinking>...</thinking> ou <think>...</think> e tags não fechadas.
 */
export function stripThinking(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<(thinking|think)>[\s\S]*?<\/(thinking|think)>/gi, "");
  // Remove tag não fechada no final do texto (se houver)
  cleaned = cleaned.replace(/<(thinking|think)>[\s\S]*$/gi, "");
  return cleaned.trim();
}

/**
 * Extrai o conteúdo acumulado de todos os blocos <thinking> ou <think> encontrados no texto.
 */
export function extractThinking(text: string): string {
  if (!text) return "";
  const matches = [...text.matchAll(/<(thinking|think)>([\s\S]*?)<\/(thinking|think)>/gi)];
  if (matches.length > 0) {
    return matches.map((m) => m[2].trim()).filter(Boolean).join("\n\n");
  }
  // Se houver uma tag não fechada
  const unclosed = text.match(/<(thinking|think)>([\s\S]*)$/i);
  return unclosed ? unclosed[2].trim() : "";
}
