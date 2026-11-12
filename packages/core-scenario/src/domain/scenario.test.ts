import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScenario, ScenarioValidationError } from './scenario.js';

const VALID = {
  name: 'demo',
  docs: [
    { id: 'a', text: 'alpha' },
    { id: 'b', text: 'beta' },
  ],
  labels: { alpha: ['a'] },
};

test('shouldAcceptValidScenario', () => {
  const scenario = parseScenario(VALID);
  assert.equal(scenario.name, 'demo');
  assert.equal(scenario.docs.length, 2);
  assert.deepEqual(scenario.labels.alpha, ['a']);
});

test('shouldRejectEmptyDocs', () => {
  assert.throws(
    () => parseScenario({ ...VALID, docs: [] }),
    ScenarioValidationError,
  );
});

test('shouldRejectDuplicateDocumentIds', () => {
  assert.throws(
    () => parseScenario({ ...VALID, docs: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }),
    /文档 id 重复/,
  );
});

test('shouldRejectLabelPointingToUnknownDocument', () => {
  assert.throws(
    () => parseScenario({ ...VALID, labels: { alpha: ['missing'] } }),
    /不存在的文档/,
  );
});

test('shouldRejectEmptyQuery', () => {
  assert.throws(
    () => parseScenario({ ...VALID, labels: { '   ': ['a'] } }),
    /查询不能为空/,
  );
});

test('shouldRejectDuplicateRelevanceIds', () => {
  assert.throws(
    () => parseScenario({ ...VALID, labels: { alpha: ['a', 'a'] } }),
    /重复真值/,
  );
});
