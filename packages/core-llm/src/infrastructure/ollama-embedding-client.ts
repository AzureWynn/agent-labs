import type { EmbeddingClient } from '../domain/embedding.js';

export interface OllamaEmbeddingOptions {
  readonly host: string;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

function isVector(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

export class OllamaEmbeddingClient implements EmbeddingClient {
  private readonly host: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaEmbeddingOptions) {
    this.host = options.host.replace(/\/+$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 240_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.host}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ollama 嵌入请求失败: ${response.status} ${response.statusText}`);
      }
      const payload = (await response.json()) as { embeddings?: unknown };
      if (
        !Array.isArray(payload.embeddings) ||
        payload.embeddings.length !== texts.length ||
        !payload.embeddings.every(isVector)
      ) {
        throw new Error('Ollama 返回的 embeddings 与输入不一致');
      }
      return payload.embeddings;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama 嵌入请求超时（${this.timeoutMs}ms）`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
