import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export interface AppConfig {
  provider: "ollama" | "openai-compatible" | "gemini";
  ollama: {
    baseUrl: string;
    model: string;
  };
  openaiCompatible: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  memoryDir: string;
}

export const config: AppConfig = {
  provider: (process.env.LLM_PROVIDER as AppConfig["provider"]) || "ollama",
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
  },
  openaiCompatible: {
    baseUrl: process.env.OPENAI_BASE_URL || "http://localhost:8080/v1",
    apiKey: process.env.OPENAI_API_KEY || "not-needed",
    model: process.env.OPENAI_MODEL || "qwen2.5-7b",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  },
  memoryDir: path.resolve(process.cwd(), "memory"),
};

