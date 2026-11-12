import assert from 'node:assert/strict';
import test from 'node:test';
import type { Document } from '@agentlab/core-retrieval';
import {
  benchmarkIndexes,
  exactTopKSets,
  measureRecallFromIds,
} from './benchmark.js';
import type { VectorIndex } from './vector-index.js';

const docs: Document[] = [
  { id: 'a', text: '' },
  { id: 'b', text: '' },
  { id: 'c', text: '' },
];
const vectors = [
  [1, 0],
  [0, 1],
  [0.9, 0.1],
];

class FakeIndex implements VectorIndex {
  constructor(
    readonly name: string,
    private readonly picks: number[][],
  ) {}

  async build(): Promise<void> {}

  search(): number[] {
    return this.picks.shift() ?? [];
  }
}

test('shouldUseExactSearchAsGroundTruth', () => {
  const sets = exactTopKSets(docs, vectors, [[1, 0]], 2);
  assert.deepEqual([...(sets[0] ?? [])], ['a', 'c']);
});

test('shouldMeasureRecallFromRetrievedIds', () => {
  const exactSets = [new Set(['a', 'c'])];
  assert.deepEqual(measureRecallFromIds([['a', 'c']], exactSets), {
    recallAtK: 1,
    misses: 0,
  });
  assert.deepEqual(measureRecallFromIds([['a', 'b']], exactSets), {
    recallAtK: 0.5,
    misses: 1,
  });
});

test('shouldBenchmarkEveryIndexAgainstExact', async () => {
  const results = await benchmarkIndexes(docs, vectors, [[1, 0]], 2, [
    new FakeIndex('perfect', [[0, 2]]),
    new FakeIndex('half', [[0, 1]]),
  ]);
  assert.deepEqual(
    results.map((result) => [result.name, result.recallAtK, result.misses]),
    [
      ['perfect', 1, 0],
      ['half', 0.5, 1],
    ],
  );
  assert.ok(results.every((result) => result.buildMs >= 0 && result.queryMs >= 0));
});
