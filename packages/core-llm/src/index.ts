export type { EmbeddingClient } from './domain/embedding.js';
export { normalizeOpenAiBaseUrl, resolveTimeoutMs } from './domain/endpoint.js';
export { OllamaEmbeddingClient } from './infrastructure/ollama-embedding-client.js';
export type { OllamaEmbeddingOptions } from './infrastructure/ollama-embedding-client.js';
