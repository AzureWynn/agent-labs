import assert from 'node:assert/strict';
import test from 'node:test';
import type { Scenario } from '@agentlab/core-scenario';
import { createRetrievers } from './build-retrievers.js';

const scenario: Scenario = {
  name: 'tiny',
  docs: [
    { id: 'd1', text: '电梯异响' },
    { id: 'd2', text: '车库照明' },
  ],
  labels: {
    电梯异响: ['d1'],
    车库照明: ['d2'],
  },
};

const docVectors = [[1, 0], [0, 1]];
const queryVectors = new Map([
  ['电梯异响', [1, 0]],
  ['车库照明', [0, 1]],
]);

test('shouldBuildFiveRetrievers', () => {
  const retrievers = createRetrievers({ scenario, docVectors, queryVectors });
  assert.deepEqual(
    retrievers.map((retriever) => retriever.name),
    ['BM25', 'Dense', 'Hybrid-RRF', 'Hybrid-Weighted', 'Hybrid-RRF+Rerank'],
  );
});

test('shouldReturnRelevantDocumentForEachMethod', () => {
  const retrievers = createRetrievers({ scenario, docVectors, queryVectors });
  for (const retriever of retrievers) {
    assert.equal(retriever.search('电梯异响', 1)[0], 'd1', retriever.name);
    assert.equal(retriever.search('车库照明', 1)[0], 'd2', retriever.name);
  }
});

test('shouldRejectMissingQueryVector', () => {
  const retrievers = createRetrievers({ scenario, docVectors, queryVectors: new Map() });
  const dense = retrievers.find((retriever) => retriever.name === 'Dense');
  assert.ok(dense);
  assert.throws(() => dense.search('电梯异响', 1), /缺少查询向量/);
});
