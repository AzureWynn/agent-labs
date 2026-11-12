import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScenario } from '@agentlab/core-scenario';
import { evaluate } from './evaluate.js';

const SCENARIO = parseScenario({
  name: 'demo',
  docs: [
    { id: 'a', text: 'alpha' },
    { id: 'b', text: 'beta' },
  ],
  labels: { alpha: ['a'], beta: ['b'] },
});

test('shouldScorePerfectRetrieverAsOne', () => {
  const retriever = {
    name: 'perfect',
    search: (query: string) => (query === 'alpha' ? ['a'] : ['b']),
  };
  const method = evaluate(SCENARIO, [retriever], 1)[0];
  assert.ok(method);
  assert.equal(method.recall, 1);
  assert.equal(method.precision, 1);
  assert.equal(method.mrr, 1);
  assert.equal(method.ndcg, 1);
});

test('shouldScoreEmptyRetrieverAsZero', () => {
  const retriever = { name: 'empty', search: () => [] };
  const method = evaluate(SCENARIO, [retriever], 1)[0];
  assert.ok(method);
  assert.equal(method.recall, 0);
  assert.equal(method.mrr, 0);
});

test('shouldRejectNonPositiveK', () => {
  assert.throws(() => evaluate(SCENARIO, [], 0), /k 必须大于 0/);
});
