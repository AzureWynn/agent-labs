import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore } from './memory-store.js';
import { legacySubstringSearch } from './retrieval.js';

function createStore(): MemoryStore {
  let counter = 0;
  return new MemoryStore({
    now: () => new Date('2026-10-21T00:00:00.000Z'),
    nextId: () => `m${(counter += 1)}`,
  });
}

function seed(): MemoryStore {
  const store = createStore();
  store.add({ content: '用户是王女士', sessionId: 's1' });
  store.add({ content: '用户养了一只猫，叫花花', sessionId: 's1' });
  store.add({ content: '花花下次疫苗是5月10日', sessionId: 's1' });
  store.add({ content: '花花对鸡肉过敏', sessionId: 's1' });
  store.add({ content: '用户电话是13800001111', sessionId: 's1' });
  return store;
}

test('shouldFindVaccineMemoryByWordTerms', () => {
  const store = seed();
  const results = store.search('花花疫苗', 3);
  assert.equal(results[0]?.content, '花花下次疫苗是5月10日');
});

test('shouldShowLegacySubstringFailure', () => {
  const store = seed();
  assert.deepEqual(legacySubstringSearch(store.all(), '花花疫苗', 3), []);
});

test('shouldFindPhoneMemoryByAttributeTerm', () => {
  const store = seed();
  const results = store.search('电话', 3);
  assert.equal(results[0]?.content, '用户电话是13800001111');
});

test('shouldExposeEntityAttributeAmbiguity', () => {
  const store = seed();
  const results = store.search('王女士电话', 3);
  assert.equal(results[0]?.content, '用户是王女士');
  assert.ok(results.some((item) => item.content === '用户电话是13800001111'));
});

test('shouldFindAllergyMemory', () => {
  const store = seed();
  const results = store.search('花花对什么过敏', 3);
  assert.equal(results[0]?.content, '花花对鸡肉过敏');
});

test('shouldReturnEmptyForUnrelatedQuery', () => {
  const store = seed();
  assert.deepEqual(store.search('量子物理', 3), []);
});

test('shouldReturnEmptyWhenKIsZero', () => {
  const store = seed();
  assert.deepEqual(store.search('花花', 0), []);
});
