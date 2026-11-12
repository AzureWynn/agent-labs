import assert from 'node:assert/strict';
import test from 'node:test';
import { rrfFuse, weightedFuse } from './fusion.js';
import type { ScoredDocument } from './types.js';

function doc(id: string, score: number): ScoredDocument {
  return { id, text: `text-${id}`, score };
}

test('shouldFuseByReciprocalRank', () => {
  const fused = rrfFuse([
    [doc('a', 0.9), doc('b', 0.8)],
    [doc('b', 5), doc('c', 4)],
  ], 60);

  assert.deepEqual(fused.map((item) => item.id), ['b', 'a', 'c']);
  assert.equal(fused[0]?.text, 'text-b');
});

test('shouldFuseByWeightedNormalizedScores', () => {
  const fused = weightedFuse(
    [doc('a', 0.9), doc('b', 0.5)],
    [doc('b', 10), doc('c', 5)],
    0.7,
    0.3,
  );

  assert.deepEqual(fused.map((item) => item.id), ['a', 'b', 'c']);
  assert.equal(fused[0]?.score, 0.7);
  assert.equal(fused[1]?.score, 0.3);
});

test('shouldKeepSingleDocumentAtFullScoreAfterNormalization', () => {
  const fused = weightedFuse([doc('only', 0.42)], [], 0.5, 0.5);
  assert.deepEqual(fused.map((item) => item.id), ['only']);
  assert.equal(fused[0]?.score, 0.5);
});
