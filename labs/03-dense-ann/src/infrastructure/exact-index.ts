import { cosineSimilarity } from '@agentlab/core-retrieval';
import type { VectorIndex } from '../application/vector-index.js';
import { assertVectorDimension, validateVectors } from '../application/vector-index.js';

export class ExactVectorIndex implements VectorIndex {
  readonly name = 'Exact';
  private vectors: readonly number[][] = [];
  private dimension = 0;

  async build(vectors: readonly number[][]): Promise<void> {
    this.dimension = validateVectors(vectors);
    this.vectors = vectors;
  }

  search(query: readonly number[], k: number): number[] {
    if (this.vectors.length === 0) {
      throw new Error('精确索引尚未构建');
    }
    assertVectorDimension(query, this.dimension, '查询向量');
    if (k <= 0) return [];
    return this.vectors
      .map((vector, index) => ({ index, score: cosineSimilarity(query, vector) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, k)
      .map((item) => item.index);
  }
}
