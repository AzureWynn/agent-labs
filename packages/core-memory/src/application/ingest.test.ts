import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore } from '../domain/memory-store.js';
import { duplicateRate, ingestCandidates } from './ingest.js';

function createStore(): MemoryStore {
  let counter = 0;
  return new MemoryStore({
    now: () => new Date('2026-10-21T00:00:00.000Z'),
    nextId: () => `m${(counter += 1)}`,
  });
}

test('shouldCountAddedAndMergedCandidates', () => {
  const store = createStore();
  const stats = ingestCandidates(store, [
    { content: '用户喜欢喝咖啡', sessionId: 's1' },
    { content: '用户喜欢咖啡', sessionId: 's1' },
    { content: '花花下次疫苗是5月10日', sessionId: 's1' },
    { content: '花花的疫苗安排在5月10日', sessionId: 's1' },
  ]);
  assert.deepEqual(stats, {
    raw: 4,
    added: 2,
    mergedExact: 0,
    mergedNear: 2,
    unique: 2,
  });
  assert.equal(duplicateRate(stats), 0.5);
});
