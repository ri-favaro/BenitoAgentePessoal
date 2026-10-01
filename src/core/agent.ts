import { streamText, type CoreMessage } from "ai";
import { getLanguageModel } from "./llm.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { getAgentTools } from "../tools/index.js";

export class PersonalAgent {
  private messages: CoreMessage[] = [];
  public memoryManager: MemoryManager;

  constructor(memoryManager = new MemoryManager()) {
    this.memoryManager = memoryManager;
  }

  async ask(
    userInput: string,
    callbacks?: {
      onToken?: (chunk: string) => void;
      onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
    }
  ): Promise<string> {
    this.messages.push({ role: "user", content: userInput });

    const systemPrompt = await this.memoryManager.buildSystemPrompt();
    const model = getLanguageModel();
    const tools = getAgentTools(this.memoryManager);

    let hadToolCalls = false;
    const result = streamText({
      model,
      system: systemPrompt,
      messages: this.messages,
      tools,
      maxSteps: 8,
      onStepFinish: (step) => {
        if (step.toolCalls && step.toolCalls.length > 0) {
          hadToolCalls = true;
          for (const call of step.toolCalls) {
            callbacks?.onToolCall?.(
              call.toolName,
              call.args as Record<string, unknown>
            );
          }
        }
      },
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
      callbacks?.onToken?.(chunk);
    }

    try {
      const response = await result.response;
      if (response && response.messages && response.messages.length > 0) {
        this.messages.push(...response.messages);
      } else {
        this.messages.push({ role: "assistant", content: fullText });
      }
    } catch {
      this.messages.push({ role: "assistant", content: fullText });
    }

    // Guarda Anti-Estagnação: Se o modelo prometeu buscar/ler em texto mas não chamou
    // nenhuma ferramenta no turno, forçamos o disparo imediato da ferramenta
    const promisePattern =
      /(?:vou|vamos) (?:fazer (?:uma nova|outra)|buscar|pesquisar|ler|procurar|consultar|verificar)/i;

    if (!hadToolCalls && promisePattern.test(fullText.slice(-350))) {
      this.messages.push({
        role: "user",
        content:
          "[Instrução do Sistema: Você prometeu buscar ou ler a informação. Acione a ferramenta search_web ou fetch_web_page IMEDIATAMENTE para concluir a tarefa para o usuário.]",
      });

      const continuation = streamText({
        model,
        system: systemPrompt,
        messages: this.messages,
        tools,
        maxSteps: 6,
        onStepFinish: (step) => {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const call of step.toolCalls) {
              callbacks?.onToolCall?.(
                call.toolName,
                call.args as Record<string, unknown>
              );
            }
          }
        },
      });

      let contText = "";
      callbacks?.onToken?.("\n");
      for await (const chunk of continuation.textStream) {
        contText += chunk;
        callbacks?.onToken?.(chunk);
      }
      fullText += "\n" + contText;

      try {
        const contResponse = await continuation.response;
        if (
          contResponse &&
          contResponse.messages &&
          contResponse.messages.length > 0
        ) {
          this.messages.push(...contResponse.messages);
        } else {
          this.messages.push({ role: "assistant", content: contText });
        }
      } catch {
        this.messages.push({ role: "assistant", content: contText });
      }
    }

    return fullText;
  }

  clearHistory(): void {
    this.messages = [];
  }

  getHistory(): CoreMessage[] {
    return [...this.messages];
  }
}
