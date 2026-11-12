import { createRequire } from 'node:module';
import type { VectorIndex } from '../application/vector-index.js';
import { assertVectorDimension, validateVectors } from '../application/vector-index.js';

interface AnnoyHandle {
  addItem(index: number, vector: number[]): void;
  build(nTrees: number): void;
  getNNsByVector(vector: number[], k: number): number[];
}

type AnnoyConstructor = new (dimension: number, metric: string) => AnnoyHandle;

const require = createRequire(import.meta.url);
const Annoy = require('annoy') as AnnoyConstructor;

export class AnnoyVectorIndex implements VectorIndex {
  readonly name = 'ANNOY';
  private index: AnnoyHandle | null = null;
  private dimension = 0;

  constructor(private readonly nTrees = 50) {
    if (!Number.isInteger(nTrees) || nTrees <= 0) {
      throw new Error('nTrees 必须是正整数');
    }
  }

  async build(vectors: readonly number[][]): Promise<void> {
    this.dimension = validateVectors(vectors);
    const index = new Annoy(this.dimension, 'angular');
    for (let i = 0; i < vectors.length; i += 1) {
      index.addItem(i, [...(vectors[i] ?? [])]);
    }
    index.build(this.nTrees);
    this.index = index;
  }

  search(query: readonly number[], k: number): number[] {
    if (!this.index) {
      throw new Error('ANNOY 索引尚未构建');
    }
    assertVectorDimension(query, this.dimension, '查询向量');
    if (k <= 0) return [];
    return this.index.getNNsByVector([...query], k);
  }
}
