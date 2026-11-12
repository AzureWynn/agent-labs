import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryStore } from './memory-store.js';
import { contentTokens, overlapCoefficient, queryTokens } from './dedup.js';

function createStore(): MemoryStore {
  let counter = 0;
  return new MemoryStore({
    now: () => new Date('2026-10-21T00:00:00.000Z'),
    nextId: () => `m${(counter += 1)}`,
  });
}

test('shouldMergeExactContentIgnoringCaseAndPunctuation', () => {
  const store = createStore();
  store.add({ content: '用户喜欢喝咖啡。', sessionId: 's1' });
  const result = store.add({ content: '用户喜欢喝咖啡', sessionId: 's1' });
  assert.equal(result.outcome, 'exact');
  assert.equal(store.size, 1);
});

test('shouldMergeNearDuplicatePreferences', () => {
  const store = createStore();
  store.add({ content: '用户喜欢喝咖啡', sessionId: 's1' });
  const result = store.add({ content: '用户喜欢咖啡', sessionId: 's1' });
  assert.equal(result.outcome, 'near');
  assert.equal(store.size, 1);
});

test('shouldMergeParaphrasedVaccineDate', () => {
  const store = createStore();
  store.add({ content: '花花下次疫苗是5月10日', sessionId: 's1' });
  const result = store.add({ content: '花花的疫苗安排在5月10日', sessionId: 's1' });
  assert.equal(result.outcome, 'near');
  assert.equal(store.size, 1);
});

test('shouldKeepLongerContentWhenMerging', () => {
  const store = createStore();
  store.add({ content: '花花对鸡肉过敏', sessionId: 's1' });
  store.add({ content: '花花对鸡肉严重过敏', sessionId: 's1' });
  assert.equal(store.size, 1);
  assert.equal(store.all()[0]?.content, '花花对鸡肉严重过敏');
});

test('shouldNotMergeDifferentFoods', () => {
  const store = createStore();
  store.add({ content: '花花对鸡肉过敏', sessionId: 's1' });
  const result = store.add({ content: '花花对牛肉过敏', sessionId: 's1' });
  assert.equal(result.outcome, 'added');
  assert.equal(store.size, 2);
});

test('shouldNotMergeDifferentDates', () => {
  const store = createStore();
  store.add({ content: '花花下次疫苗是5月10日', sessionId: 's1' });
  const result = store.add({ content: '花花下次疫苗是6月10日', sessionId: 's1' });
  assert.equal(result.outcome, 'added');
  assert.equal(store.size, 2);
});

test('shouldNotMergeNegatedAndAffirmedFacts', () => {
  const store = createStore();
  store.add({ content: '球球不能吃油腻', sessionId: 's1' });
  const result = store.add({ content: '球球可以吃油腻', sessionId: 's1' });
  assert.equal(result.outcome, 'added');
  assert.equal(store.size, 2);
});

test('shouldNotMergeAllergyAndNoAllergy', () => {
  const store = createStore();
  store.add({ content: '花花对鸡肉过敏', sessionId: 's1' });
  const result = store.add({ content: '花花对鸡肉不过敏', sessionId: 's1' });
  assert.equal(result.outcome, 'added');
  assert.equal(store.size, 2);
});

test('shouldNotMergeDifferentShortNames', () => {
  const store = createStore();
  store.add({ content: '王女士', sessionId: 's1' });
  const result = store.add({ content: '李先生', sessionId: 's1' });
  assert.equal(result.outcome, 'added');
  assert.equal(store.size, 2);
});

test('shouldMergeTagsWhenDuplicate', () => {
  const store = createStore();
  store.add({ content: '花花对鸡肉过敏', sessionId: 's1', tags: ['健康'] });
  store.add({ content: '花花对鸡肉严重过敏', sessionId: 's1', tags: ['饮食'] });
  assert.deepEqual(store.all()[0]?.tags, ['健康', '饮食']);
});

test('shouldExposeContentAndQueryTokens', () => {
  assert.deepEqual(contentTokens('花花下次疫苗是5月10日'), ['花花', '疫苗', '5', '月', '10', '日']);
  assert.deepEqual(queryTokens('花花疫苗什么时候'), ['花花', '疫苗']);
  assert.equal(
    overlapCoefficient(new Set(['花花', '鸡肉', '过敏']), new Set(['花花', '鸡肉', '过敏'])),
    1,
  );
});

test('shouldMergePetNameVariantsWithDifferentFraming', () => {
  const store = createStore();
  store.add({ content: '我养了一只猫，名字叫花花', sessionId: 's1' });
  const result = store.add({ content: '宠物名叫花花，是猫', sessionId: 's1' });
  assert.equal(result.outcome, 'near');
  assert.equal(store.size, 1);
});

test('shouldMergePhoneVariantsWithSameLongNumber', () => {
  const store = createStore();
  store.add({ content: '用户电话是13900002222', sessionId: 's1' });
  const result = store.add({ content: '有事打13900002222找我', sessionId: 's1' });
  assert.equal(result.outcome, 'near');
  assert.equal(store.size, 1);
});

test('shouldKeepAttributeWordWhenMergingPhoneVariants', () => {
  const store = createStore();
  store.add({ content: '用户电话是13900002222', sessionId: 's1' });
  store.add({ content: '有事打13900002222找我', sessionId: 's1' });
  assert.equal(store.all()[0]?.content, '用户电话是13900002222');
});

test('shouldPreferSupersetContentWhenMerging', () => {
  const store = createStore();
  store.add({ content: '花花是3岁', sessionId: 's1' });
  store.add({ content: '花花今年3岁', sessionId: 's1' });
  assert.equal(store.all()[0]?.content, '花花今年3岁');
});
