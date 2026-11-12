import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMemoryScenario } from './memory-scenario.js';

test('shouldParseMinimalScenario', () => {
  const scenario = parseMemoryScenario({
    name: 'test',
    note: 'note',
    users: [
      {
        id: 'u1',
        owner: '王女士',
        pet: { name: '花花', species: '猫', age: 3 },
        facts: [{ id: 'f1', content: '用户养了一只猫，叫花花', tags: ['宠物'] }],
        rounds: [{ round: 1, user: '我家猫叫花花。', assistant: '好的。' }],
        queries: [{ query: '我家猫的名字', expectedFactIds: ['f1'] }],
      },
    ],
  });
  assert.equal(scenario.users.length, 1);
  assert.equal(scenario.users[0]?.facts[0]?.content, '用户养了一只猫，叫花花');
  assert.deepEqual(scenario.users[0]?.facts[0]?.tags, ['宠物']);
});

test('shouldRejectMissingUsers', () => {
  assert.throws(() => parseMemoryScenario({ name: 'test' }), /users/);
});

test('shouldRejectQueryWithoutExpectedFact', () => {
  assert.throws(
    () =>
      parseMemoryScenario({
        name: 'test',
        users: [
          {
            id: 'u1',
            owner: '王女士',
            pet: { name: '花花', species: '猫', age: 3 },
            facts: [],
            rounds: [],
            queries: [{ query: '花花几岁', expectedFactIds: [] }],
          },
        ],
      }),
    /expectedFactIds/,
  );
});
