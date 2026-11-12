import assert from 'node:assert/strict';
import test from 'node:test';
import { HnswVectorIndex } from './hnsw-index.js';

test('shouldFindNearestVectorWithHnsw', async () => {
  const index = new HnswVectorIndex({ M: 8, efConstruction: 50, efSearch: 10 });
  await index.build([
    [1, 0, 0],
    [0, 1, 0],
    [0.9, 0.1, 0],
  ]);
  assert.equal(index.search([1, 0, 0], 2)[0], 0);
});

test('shouldRejectWrongQueryDimensionForHnsw', async () => {
  const index = new HnswVectorIndex({ M: 8, efConstruction: 50, efSearch: 10 });
  await index.build([
    [1, 0, 0],
    [0, 1, 0],
  ]);
  assert.throws(() => index.search([1, 0], 1), /维度不一致/);
});
