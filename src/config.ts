import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export interface AppConfig {
  provider: "ollama" | "openai-compatible" | "gemini";
  searchProvider: "tavily" | "searxng";
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
  tavily: {
    apiKey: string;
  };
  searxng: {
    baseUrl: string;
  };
  memoryDir: string;
}

export const config: AppConfig = {
  provider: (process.env.LLM_PROVIDER as AppConfig["provider"]) || "ollama",
  searchProvider:
    (process.env.SEARCH_PROVIDER as AppConfig["searchProvider"]) ||
    (process.env.TAVILY_API_KEY ? "tavily" : "searxng"),
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: process.env.OLLAMA_MODEL || "qwen3.5:9b-24k",
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
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || "",
  },
  searxng: {
    baseUrl: process.env.SEARXNG_BASE_URL || "http://localhost:8080",
  },
  memoryDir: path.resolve(process.cwd(), "memory"),
};

