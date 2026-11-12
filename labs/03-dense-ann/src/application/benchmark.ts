import { performance } from 'node:perf_hooks';
import { DenseIndex } from '@agentlab/core-retrieval';
import type { Document } from '@agentlab/core-retrieval';
import type { VectorIndex } from './vector-index.js';

export interface IndexBenchmark {
  readonly name: string;
  readonly buildMs: number;
  readonly queryMs: number;
  readonly recallAtK: number;
  readonly misses: number;
}

export interface RecallResult {
  readonly recallAtK: number;
  readonly misses: number;
}

export function exactTopKSets(
  docs: readonly Document[],
  vectors: readonly number[][],
  queries: readonly number[][],
  k: number,
): ReadonlySet<string>[] {
  if (docs.length !== vectors.length) {
    throw new Error('文档数量与向量数量不一致');
  }
  if (k <= 0) {
    throw new Error('k 必须大于 0');
  }
  const exact = new DenseIndex(docs, vectors);
  return queries.map((query) => new Set(exact.search(query, k).map((doc) => doc.id)));
}

export function measureRecallFromIds(
  retrievedIds: readonly (readonly string[])[],
  exactSets: readonly ReadonlySet<string>[],
): RecallResult {
  if (retrievedIds.length !== exactSets.length) {
    throw new Error('查询数量与精确结果数量不一致');
  }
  let recallSum = 0;
  let misses = 0;
  for (let i = 0; i < retrievedIds.length; i += 1) {
    const expected = exactSets[i] ?? new Set<string>();
    const retrieved = retrievedIds[i] ?? [];
    let hits = 0;
    for (const id of retrieved) {
      if (expected.has(id)) {
        hits += 1;
      }
    }
    recallSum += expected.size === 0 ? 0 : hits / expected.size;
    if (hits < expected.size) {
      misses += 1;
    }
  }
  return {
    recallAtK: retrievedIds.length === 0 ? 0 : recallSum / retrievedIds.length,
    misses,
  };
}

export function measureRecall(
  index: VectorIndex,
  docs: readonly Document[],
  queries: readonly number[][],
  exactSets: readonly ReadonlySet<string>[],
  k: number,
): RecallResult {
  const retrievedIds = queries.map((query) =>
    index
      .search(query, k)
      .map((position) => docs[position]?.id)
      .filter((id): id is string => id !== undefined),
  );
  return measureRecallFromIds(retrievedIds, exactSets);
}

export async function benchmarkIndexes(
  docs: readonly Document[],
  vectors: readonly number[][],
  queries: readonly number[][],
  k: number,
  indexes: readonly VectorIndex[],
): Promise<IndexBenchmark[]> {
  const exactSets = exactTopKSets(docs, vectors, queries, k);
  const results: IndexBenchmark[] = [];
  for (const index of indexes) {
    const buildStart = performance.now();
    await index.build(vectors);
    const buildMs = performance.now() - buildStart;

    const retrievedIds: string[][] = [];
    const queryStart = performance.now();
    for (const query of queries) {
      retrievedIds.push(
        index
          .search(query, k)
          .map((position) => docs[position]?.id)
          .filter((id): id is string => id !== undefined),
      );
    }
    const queryMs = (performance.now() - queryStart) / queries.length;
    const recall = measureRecallFromIds(retrievedIds, exactSets);

    results.push({
      name: index.name,
      buildMs,
      queryMs,
      recallAtK: recall.recallAtK,
      misses: recall.misses,
    });
  }
  return results;
}
