import assert from 'node:assert/strict';
import test from 'node:test';
import { AnnoyVectorIndex } from './annoy-index.js';

test('shouldFindNearestVectorWithAnnoy', async () => {
  const index = new AnnoyVectorIndex(10);
  await index.build([
    [1, 0, 0],
    [0, 1, 0],
    [0.9, 0.1, 0],
  ]);
  assert.equal(index.search([1, 0, 0], 2)[0], 0);
});

test('shouldRejectWrongQueryDimensionForAnnoy', async () => {
  const index = new AnnoyVectorIndex(10);
  await index.build([
    [1, 0, 0],
    [0, 1, 0],
  ]);
  assert.throws(() => index.search([1, 0], 1), /维度不一致/);
});
