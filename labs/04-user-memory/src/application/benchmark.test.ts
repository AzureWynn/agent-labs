import assert from 'node:assert/strict';
import test from 'node:test';
import type { MemoryScenario } from '../domain/memory-scenario.js';
import type { ExtractionFixture } from './extract-candidates.js';
import { evaluateMemoryBenchmark } from './benchmark.js';

const scenario: MemoryScenario = {
  name: 'test',
  note: '',
  users: [
    {
      id: 'u1',
      owner: '王女士',
      pet: { name: '花花', species: '猫', age: 3 },
      facts: [
        { id: 'f1', content: '用户养了一只猫，叫花花', tags: ['宠物'] },
        { id: 'f2', content: '用户电话是13800001111', tags: ['联系'] },
      ],
      rounds: [{ round: 1, user: '我家猫叫花花。', assistant: '好的。' }],
      queries: [
        { query: '我家猫的名字', expectedFactIds: ['f1'] },
        { query: '电话是多少', expectedFactIds: ['f2'] },
      ],
    },
  ],
};

const fixture: ExtractionFixture = {
  scenario: 'test',
  model: 'fake',
  generatedAt: '2026-10-21T00:00:00.000Z',
  source: 'ollama',
  rounds: [
    {
      userId: 'u1',
      round: 1,
      candidates: [
        { content: '用户养了一只猫，叫花花', tags: ['宠物'] },
        { content: '用户养了一只猫，叫花花', tags: ['宠物'] },
        { content: '用户养了一只猫，名字叫花花', tags: ['宠物'] },
        { content: '用户电话是13800001111', tags: ['联系'] },
        { content: '用户喜欢喝咖啡', tags: [] },
      ],
    },
  ],
};

test('shouldCountDuplicatesAndUniqueMemories', () => {
  const report = evaluateMemoryBenchmark(scenario, fixture);
  const user = report.users[0];
  assert.equal(user?.rawCandidates, 5);
  assert.equal(user?.added, 3);
  assert.equal(user?.mergedExact, 1);
  assert.equal(user?.mergedNear, 1);
  assert.equal(user?.unique, 3);
  assert.equal(user?.duplicateRate, 0.4);
});

test('shouldEvaluateCanonicalAndExtractedRetrieval', () => {
  const report = evaluateMemoryBenchmark(scenario, fixture);
  assert.equal(report.totals.canonicalRecallAt1, 1);
  assert.equal(report.totals.canonicalRecallAt3, 1);
  assert.equal(report.totals.recallAt1, 1);
  assert.equal(report.totals.recallAt3, 1);
  assert.equal(report.totals.canonicalFacts, 2);
});

test('shouldHandleEmptyExtraction', () => {
  const report = evaluateMemoryBenchmark(scenario, {
    ...fixture,
    rounds: [],
  });
  assert.equal(report.totals.rawCandidates, 0);
  assert.equal(report.totals.unique, 0);
  assert.equal(report.totals.duplicateRate, 0);
  assert.equal(report.totals.recallAt1, 0);
  assert.equal(report.totals.canonicalRecallAt1, 1);
});
