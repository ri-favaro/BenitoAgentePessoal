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

    const result = streamText({
      model,
      system: systemPrompt,
      messages: this.messages,
      tools,
      maxSteps: 5,
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

    return fullText;
  }

  clearHistory(): void {
    this.messages = [];
  }

  getHistory(): CoreMessage[] {
    return [...this.messages];
  }
}
