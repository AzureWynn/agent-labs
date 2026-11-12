import { HNSW } from 'hnsw';
import type { VectorIndex } from '../application/vector-index.js';
import { assertVectorDimension, validateVectors } from '../application/vector-index.js';

export interface HnswOptions {
  readonly M?: number;
  readonly efConstruction?: number;
  readonly efSearch?: number;
}

export class HnswVectorIndex implements VectorIndex {
  readonly name = 'HNSW';
  private index: HNSW | null = null;
  private dimension = 0;
  private readonly M: number;
  private readonly efConstruction: number;
  private readonly efSearch: number;

  constructor(options: HnswOptions = {}) {
    this.M = options.M ?? 16;
    this.efConstruction = options.efConstruction ?? 200;
    this.efSearch = options.efSearch ?? 50;
    for (const [label, value] of [
      ['M', this.M],
      ['efConstruction', this.efConstruction],
      ['efSearch', this.efSearch],
    ] as const) {
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${label} 必须是正整数`);
      }
    }
  }

  async build(vectors: readonly number[][]): Promise<void> {
    this.dimension = validateVectors(vectors);
    const index = new HNSW(
      this.M,
      this.efConstruction,
      this.dimension,
      'cosine',
      this.efSearch,
    );
    for (let i = 0; i < vectors.length; i += 1) {
      await index.addPoint(i, [...(vectors[i] ?? [])]);
    }
    this.index = index;
  }

  search(query: readonly number[], k: number): number[] {
    if (!this.index) {
      throw new Error('HNSW 索引尚未构建');
    }
    assertVectorDimension(query, this.dimension, '查询向量');
    if (k <= 0) return [];
    return this.index.searchKNN([...query], k).map((result) => result.id);
  }
}
