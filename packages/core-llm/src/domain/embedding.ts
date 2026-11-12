export interface EmbeddingClient {
  embed(texts: readonly string[]): Promise<number[][]>;
}
