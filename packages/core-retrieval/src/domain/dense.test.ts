import assert from 'node:assert/strict';
import test from 'node:test';
import { cosineSimilarity, DenseIndex } from './dense.js';
import type { Document } from './types.js';

const docs: Document[] = [
  { id: 'a', text: 'alpha' },
  { id: 'b', text: 'beta' },
];

test('shouldComputeCosineSimilarity', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 0]), 0);
});

test('shouldRankBySimilarity', () => {
  const index = new DenseIndex(docs, [[1, 0], [0, 1]]);
  assert.deepEqual(index.search([0.9, 0.1], 1).map((doc) => doc.id), ['a']);
  assert.deepEqual(index.search([0.1, 0.9], 2).map((doc) => doc.id), ['b', 'a']);
});

test('shouldReturnEmptyWhenKIsZero', () => {
  const index = new DenseIndex(docs, [[1, 0], [0, 1]]);
  assert.deepEqual(index.search([1, 0], 0), []);
});

test('shouldRejectMismatchedVectorCount', () => {
  assert.throws(() => new DenseIndex(docs, [[1, 0]]), /数量不一致/);
});
