import assert from 'node:assert/strict';
import test from 'node:test';
import { createSyntheticVectors } from './synthetic-vectors.js';

const options = {
  count: 6,
  dimension: 4,
  clusters: 2,
  noise: 0.1,
  seed: 7,
  queryCount: 3,
};

test('shouldCreateRequestedNumberOfVectorsAndQueries', () => {
  const dataset = createSyntheticVectors(options);
  assert.equal(dataset.vectors.length, 6);
  assert.equal(dataset.queries.length, 3);
  assert.ok(dataset.vectors.every((vector) => vector.length === 4));
  assert.ok(dataset.queries.every((vector) => vector.length === 4));
});

test('shouldBeDeterministicForSameSeed', () => {
  assert.deepEqual(createSyntheticVectors(options), createSyntheticVectors(options));
});

test('shouldChangeVectorsForDifferentSeed', () => {
  assert.notDeepEqual(
    createSyntheticVectors(options).vectors,
    createSyntheticVectors({ ...options, seed: 8 }).vectors,
  );
});

test('shouldRejectInvalidCounts', () => {
  assert.throws(() => createSyntheticVectors({ ...options, count: 0 }), /正整数/);
  assert.throws(() => createSyntheticVectors({ ...options, dimension: 0 }), /正整数/);
  assert.throws(() => createSyntheticVectors({ ...options, noise: -1 }), /非负数/);
});
