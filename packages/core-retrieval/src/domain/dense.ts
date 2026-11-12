import type { Document, ScoredDocument } from './types.js';

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let normLeft = 0;
  let normRight = 0;
  for (let i = 0; i < length; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    dot += a * b;
    normLeft += a * a;
    normRight += b * b;
  }
  const denominator = Math.sqrt(normLeft) * Math.sqrt(normRight);
  return denominator > 0 ? dot / denominator : 0;
}

/**
 * 只负责"向量已就绪"之后的相似度排序。
 * 向量怎么来（Ollama / OpenAI / 缓存）由 core-llm 和 lab 决定。
 */
export class DenseIndex {
  private readonly docs: readonly Document[];
  private readonly vectors: readonly (readonly number[])[];

  constructor(docs: readonly Document[], vectors: readonly (readonly number[])[]) {
    if (docs.length !== vectors.length) {
      throw new Error('文档数量与向量数量不一致');
    }
    this.docs = docs;
    this.vectors = vectors;
  }

  search(queryVector: readonly number[], k: number): ScoredDocument[] {
    if (k <= 0) return [];
    return this.docs
      .map((doc, index) => ({
        ...doc,
        score: cosineSimilarity(queryVector, this.vectors[index] ?? []),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, k);
  }
}
