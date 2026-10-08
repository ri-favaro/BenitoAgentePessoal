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
  telegram: {
    botToken: string;
    allowedUserIds: number[];
    sessionTimeoutMinutes: number;
  };
  filesystem: {
    allowedPaths: string[];
  };
  finance: {
    vaultPath: string;
    financeDir: string;
  };
  embedding: {
    baseUrl: string;
    model: string;
    dimensions: number;
    timeoutMs: number;
  };
  vectorStore: {
    dbPath: string;
  };
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
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_ID || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => Number(id))
      .filter((id) => !isNaN(id)),
    sessionTimeoutMinutes: Number(
      process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES || 120
    ),
  },
  filesystem: {
    allowedPaths: (process.env.ALLOWED_DIRECTORIES
      ? process.env.ALLOWED_DIRECTORIES.split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [process.cwd()]
    ).map((dir) => path.resolve(dir)),
  },
  finance: {
    vaultPath: path.resolve(
      process.env.OBSIDIAN_VAULT_PATH || "G:\\CofreObsidian\\AgentePessoal"
    ),
    financeDir: path.resolve(
      process.env.OBSIDIAN_FINANCE_DIR ||
        path.join(
          process.env.OBSIDIAN_VAULT_PATH || "G:\\CofreObsidian\\AgentePessoal",
          "Financas"
        )
    ),
  },
  embedding: {
    baseUrl: process.env.EMBEDDING_BASE_URL || "http://localhost:8085/v1",
    model: process.env.EMBEDDING_MODEL || "unsloth/embeddinggemma-2-GGUF",
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS || 768),
    timeoutMs: Number(process.env.EMBEDDING_TIMEOUT_MS || 120000),
  },
  vectorStore: {
    dbPath: path.resolve(
      process.env.VECTOR_STORE_PATH || path.join(process.cwd(), ".lancedb")
    ),
  },
};

