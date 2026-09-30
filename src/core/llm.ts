import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "../config.js";

export function getLanguageModel() {
  if (config.provider === "gemini") {
    if (!config.gemini.apiKey) {
      throw new Error(
        "GEMINI_API_KEY não configurada no arquivo .env. Obtenha uma chave gratuita em https://aistudio.google.com/"
      );
    }
    const google = createGoogleGenerativeAI({
      apiKey: config.gemini.apiKey,
    });
    return google(config.gemini.model);
  }

  if (config.provider === "openai-compatible") {
    const custom = createOpenAI({
      baseURL: config.openaiCompatible.baseUrl,
      apiKey: config.openaiCompatible.apiKey,
    });
    return custom(config.openaiCompatible.model);
  }

  // Padrão: Ollama via endpoint OpenAI compatível
  const ollama = createOpenAI({
    baseURL: config.ollama.baseUrl,
    apiKey: "ollama",
  });
  return ollama(config.ollama.model);
}

