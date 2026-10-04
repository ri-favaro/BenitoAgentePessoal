import { streamText, type CoreMessage } from "ai";
import { getLanguageModel } from "./llm.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { getAgentTools } from "../tools/index.js";
import { createWebToolsState } from "../tools/web-tools.js";

export class PersonalAgent {
  private messages: CoreMessage[] = [];
  public memoryManager: MemoryManager;
  public webToolsState = createWebToolsState();

  constructor(memoryManager = new MemoryManager()) {
    this.memoryManager = memoryManager;
  }

  /**
   * Otimiza a memória RAM e VRAM do modelo podando resultados antigos de ferramentas
   * (como páginas web inteiras) para que a janela de contexto do Ollama não estoure.
   */
  private pruneOldMessages(): void {
    let toolResultCount = 0;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === "tool" && Array.isArray(msg.content)) {
        toolResultCount++;
        // Mantém íntegro apenas o resultado mais recente (do turno atual).
        // Resultados de ferramentas de turnos anteriores são encurtados para economia máxima de VRAM/contexto.
        if (toolResultCount > 1) {
          for (const part of msg.content) {
            if (part && typeof part === "object" && "result" in part) {
              const res = part.result as Record<string, unknown>;
              if (res && typeof res.content === "string" && res.content.length > 500) {
                res.content =
                  res.content.slice(0, 400) +
                  "\n... [Conteúdo de leitura web de turno anterior resumido para economia de VRAM]";
              }
              if (res && typeof res.summary === "string" && res.summary.length > 600) {
                res.summary =
                  res.summary.slice(0, 500) +
                  "\n... [Resumo de busca de turno anterior resumido para economia de VRAM]";
              }
            }
          }
        }
      }
    }

    // Janela deslizante de segurança: evita acúmulo desnecessário de dezenas de mensagens
    if (this.messages.length > 24) {
      const head = this.messages.slice(0, 2);
      const tail = this.messages.slice(-20);
      this.messages = [...head, ...tail];
    }
  }

  async ask(
    userInput: string,
    callbacks?: {
      onToken?: (chunk: string) => void;
      onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
    }
  ): Promise<string> {
    this.pruneOldMessages();
    this.messages.push({ role: "user", content: userInput });

    const systemPrompt = await this.memoryManager.buildSystemPrompt();
    const model = getLanguageModel();
    const tools = getAgentTools(this.memoryManager, this.webToolsState);

    let hadToolCalls = false;
    const result = streamText({
      model,
      system: systemPrompt,
      messages: this.messages,
      tools,
      maxSteps: 5,
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

    let finishReason = "";
    try {
      finishReason = (await result.finishReason) || "";
    } catch {}

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
    // nenhuma ferramenta no turno, forçamos o disparo imediato da ferramenta (no máximo 1 vez)
    const promisePattern =
      /(?:vou|vamos) (?:fazer (?:uma nova|outra)|buscar|pesquisar|ler|procurar|consultar|verificar)/i;

    if (!hadToolCalls && promisePattern.test(fullText.slice(-350))) {
      this.messages.push({
        role: "user",
        content:
          "[Instrução do Sistema: Você prometeu buscar ou ler a informação. Acione a ferramenta search_web ou fetch_web_page IMEDIATAMENTE para concluir a tarefa para o usuário. Não prometa sem acionar a ferramenta.]",
      });

      const continuation = streamText({
        model,
        system: systemPrompt,
        messages: this.messages,
        tools,
        maxSteps: 4,
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

    // Se o último passo do ciclo emitiu tool-calls que não foram executadas (por exemplo, maxSteps atingido),
    // removemos ou limpamos a chamada órfã para não quebrar o protocolo OpenAI/Ollama com tool-calls sem tool-result
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && Array.isArray(lastMsg.content)) {
      const hasDanglingToolCall = lastMsg.content.some(
        (part: any) => part && (part.type === "tool-call" || part.type === "tool_call")
      );
      if (hasDanglingToolCall) {
        const textParts = lastMsg.content.filter(
          (part: any) => part && part.type === "text" && part.text?.trim()
        );
        if (textParts.length > 0) {
          lastMsg.content = textParts;
        } else {
          this.messages.pop();
        }
      }
    }

    // Guarda de Síntese Final Obrigatória:
    // Se o ciclo de passos terminou num resultado de ferramenta (sem mensagem final do assistente),
    // ou se o modelo chamou ferramentas e terminou mudo,
    // ou se a resposta foi truncada (finishReason === 'length' ou menos de 80 caracteres sem pontuação final),
    // forçamos uma geração final direta SEM ferramentas para responder imediatamente ao usuário.
    const lastMessage = this.messages[this.messages.length - 1];
    const endsWithTool = lastMessage && lastMessage.role === "tool";
    const trimmedFull = fullText.trim();
    const isTruncated =
      finishReason === "length" ||
      (hadToolCalls && trimmedFull.length > 0 && trimmedFull.length < 80 && !/[.!?:]$/.test(trimmedFull));
    const needsSynthesis = endsWithTool || (hadToolCalls && !trimmedFull) || isTruncated;

    if (needsSynthesis) {
      if (trimmedFull.length > 0) {
        callbacks?.onToken?.(" ");
      } else {
        callbacks?.onToken?.("\n");
      }

      const synthesisPrompt =
        systemPrompt +
        "\n\nAVISO CRÍTICO DO SISTEMA: O ciclo de ferramentas foi encerrado e você NÃO tem mais acesso a nenhuma ferramenta. Com base em TODOS os dados, snippets, links e leituras obtidas nas mensagens anteriores, elabore e envie AGORA sua resposta final, completa, precisa e traduzida para o português brasileiro." +
        (isTruncated && trimmedFull.length > 0
          ? ` Sua mensagem anterior começou com "${trimmedFull.slice(-80)}", continue exatamente a partir daí para concluir a resposta sem repetir o que já foi dito.`
          : " Entregue a resposta conclusiva diretamente ao usuário com as informações já coletadas.");

      const synthesis = streamText({
        model,
        system: synthesisPrompt,
        messages: this.messages,
      });

      let synthText = "";
      for await (const chunk of synthesis.textStream) {
        synthText += chunk;
        callbacks?.onToken?.(chunk);
      }

      if (synthText.trim()) {
        fullText += (fullText.trim() ? " " : "") + synthText.trim();
        try {
          const synthResp = await synthesis.response;
          if (synthResp && synthResp.messages && synthResp.messages.length > 0) {
            this.messages.push(...synthResp.messages);
          } else {
            this.messages.push({ role: "assistant", content: synthText });
          }
        } catch {
          this.messages.push({ role: "assistant", content: synthText });
        }
      }
    }

    // Se ferramentas foram executadas mas o modelo terminou mudo (sem síntese textual),
    // sintetizamos automaticamente o resultado das ferramentas para nunca deixar o usuário sem resposta
    if (!fullText.trim() && hadToolCalls) {
      const toolSummaries: string[] = [];
      for (const msg of this.messages.slice(-8)) {
        if (msg.role === "tool" && Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part && typeof part === "object" && "result" in part) {
              const res = part.result as Record<string, unknown>;
              if (res && typeof res.message === "string") {
                toolSummaries.push(res.message);
              }
            }
          }
        }
      }
      if (toolSummaries.length > 0) {
        fullText = `Pronto! Operações realizadas com sucesso:\n• ${toolSummaries.join("\n• ")}`;
        callbacks?.onToken?.(fullText);
        this.messages.push({ role: "assistant", content: fullText });
      }
    }

    this.pruneOldMessages();
    return fullText;
  }

  clearHistory(): void {
    this.messages = [];
    this.webToolsState.clear();
  }

  getHistory(): CoreMessage[] {
    return [...this.messages];
  }
}
