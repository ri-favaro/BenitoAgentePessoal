import { config } from "../config.js";

export interface EmbeddingResponseItem {
  embedding: number[];
  index: number;
}

export interface EmbeddingOptions {
  dimensions?: number;
  timeoutMs?: number;
}

/**
 * Normaliza um vetor para norma L2 unitária (essencial após truncamento Matryoshka / MRL).
 */
export function normalizeL2(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/**
 * Calcula a similaridade de cosseno entre dois vetores normalizados (produto escalar).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  return dotProduct;
}

export class EmbeddingService {
  private baseUrl: string;
  private model: string;
  private defaultDimensions: number;
  private defaultTimeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    model?: string;
    dimensions?: number;
    timeoutMs?: number;
  }) {
    this.baseUrl = (options?.baseUrl || config.embedding.baseUrl).replace(/\/+$/, "");
    this.model = options?.model || config.embedding.model;
    this.defaultDimensions = options?.dimensions || config.embedding.dimensions;
    this.defaultTimeoutMs = options?.timeoutMs || config.embedding.timeoutMs;
  }

  /**
   * Verifica se o serviço de embeddings está online e acessível.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const url = `${this.baseUrl}/models`;
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timer);

      if (response && response.ok) return true;

      // Fallback: tenta uma requisição rápida de embedding para checar /embeddings
      const test = await this.getEmbedding("ping", { timeoutMs: 2000 });
      return test.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gera o vetor de embedding para um único texto.
   */
  async getEmbedding(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const batch = await this.getBatchEmbeddings([text], options);
    if (!batch[0] || batch[0].length === 0) {
      throw new Error("Nenhum vetor retornado pelo serviço de embeddings.");
    }
    return batch[0];
  }

  /**
   * Gera vetores de embedding para um conjunto de textos em lotes (batching).
   */
  async getBatchEmbeddings(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    if (!texts || texts.length === 0) return [];

    const targetDimensions = options?.dimensions || this.defaultDimensions;
    const timeoutMs = options?.timeoutMs || this.defaultTimeoutMs;
    const batchSize = 2;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      try {
        const batchVectors = await this.fetchEmbeddingsInternal(slice, timeoutMs);

        for (const rawVec of batchVectors) {
          let processed = rawVec;
          // Truncamento Matryoshka (MRL) e re-normalização caso dimensões < tamanho do vetor
          if (targetDimensions > 0 && targetDimensions < processed.length) {
            processed = normalizeL2(processed.slice(0, targetDimensions));
          } else {
            processed = normalizeL2(processed);
          }
          results.push(processed);
        }
      } catch (batchError: any) {
        // Se o erro foi de conexão indisponível/timeout geral, propaga imediatamente o erro de infraestrutura
        if (
          batchError.code === "ECONNREFUSED" ||
          batchError.message?.includes("inacessível") ||
          batchError.message?.includes("fetch failed")
        ) {
          throw batchError;
        }

        // Caso contrário (ex: status 400 por estouro de tokens ou erro de payload), processa item a item
        for (const text of slice) {
          const safeText = text.length > 3000 ? text.slice(0, 3000) : text;
          try {
            const [singleVec] = await this.fetchEmbeddingsInternal([safeText], timeoutMs);
            let processed = singleVec || [];
            if (processed.length > 0) {
              if (targetDimensions > 0 && targetDimensions < processed.length) {
                processed = normalizeL2(processed.slice(0, targetDimensions));
              } else {
                processed = normalizeL2(processed);
              }
            }
            results.push(processed);
          } catch (singleErr: any) {
            console.warn(
              `[EmbeddingService] Falha ao processar item individual: ${singleErr.message}`
            );
            results.push([]);
          }
        }
      }
    }

    return results;
  }

  private async fetchEmbeddingsInternal(
    inputs: string[],
    timeoutMs: number
  ): Promise<number[][]> {
    const endpoint = `${this.baseUrl}/embeddings`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: inputs,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Serviço de embeddings retornou status HTTP ${response.status}: ${errorText}`
        );
      }

      const json: any = await response.json();
      if (!json || !Array.isArray(json.data)) {
        throw new Error("Formato de resposta inesperado da API de embeddings.");
      }

      const sorted = json.data.sort(
        (a: EmbeddingResponseItem, b: EmbeddingResponseItem) => a.index - b.index
      );
      return sorted.map((item: EmbeddingResponseItem) => item.embedding);
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(
          `Timeout de ${timeoutMs}ms ao aguardar resposta do serviço de embeddings em '${endpoint}'.`
        );
      }
      if (error.code === "ECONNREFUSED" || error.message?.includes("fetch failed")) {
        throw new Error(
          `Serviço de embeddings local inacessível em '${endpoint}'. Certifique-se de iniciar o servidor executando 'npm run embedding:serve' ou 'scripts/start-embedding-server.ps1'.`
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
