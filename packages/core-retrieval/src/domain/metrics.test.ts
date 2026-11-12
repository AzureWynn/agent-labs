import assert from 'node:assert/strict';
import test from 'node:test';
import { mean, ndcgAtK, precisionAtK, recallAtK, reciprocalRank } from './metrics.js';

test('shouldComputeRecallAtK', () => {
  assert.equal(recallAtK(['a', 'b', 'c'], ['b', 'd'], 3), 0.5);
  assert.equal(recallAtK(['a', 'b', 'c'], ['b', 'd'], 2), 0.5);
  assert.equal(recallAtK(['a', 'b', 'c'], ['b', 'd'], 1), 0);
});

test('shouldComputePrecisionAtK', () => {
  assert.equal(precisionAtK(['a', 'b', 'c'], ['b'], 3), 1 / 3);
  assert.equal(precisionAtK([], ['b'], 3), 0);
});

test('shouldComputeReciprocalRank', () => {
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['c'], 3), 1 / 3);
  assert.equal(reciprocalRank(['a', 'b', 'c'], ['z'], 3), 0);
});

test('shouldComputeNdcgAtK', () => {
  const perfect = ndcgAtK(['a', 'b'], ['a', 'b'], 2);
  assert.equal(perfect, 1);
  const half = ndcgAtK(['x', 'a'], ['a'], 2);
  assert.ok(half > 0 && half < 1);
  assert.equal(ndcgAtK(['x'], ['a'], 1), 0);
});

test('shouldComputeMean', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(mean([]), 0);
});
