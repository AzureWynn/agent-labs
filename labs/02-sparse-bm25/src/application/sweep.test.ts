import assert from 'node:assert/strict';
import test from 'node:test';
import type { Scenario } from '@agentlab/core-scenario';
import { bestRow, sweepBm25 } from './sweep.js';
import type { SweepRow } from './sweep.js';

const scenario: Scenario = {
  name: 'tiny',
  docs: [
    { id: 'd1', text: 'alpha' },
    { id: 'd2', text: 'beta' },
  ],
  labels: { alpha: ['d1'], beta: ['d2'] },
};

test('shouldSweepEveryK1AndBPair', () => {
  const rows = sweepBm25(scenario, {
    k1Values: [1.5, 2.0],
    bValues: [0, 1],
    k: 1,
  });

  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((row) => [row.k1, row.b]),
    [
      [1.5, 0],
      [1.5, 1],
      [2, 0],
      [2, 1],
    ],
  );
  for (const row of rows) {
    assert.equal(row.recall, 1);
    assert.equal(row.mrr, 1);
    assert.equal(row.ndcg, 1);
  }
});

test('shouldPickBestRowByMetricThenMrr', () => {
  const rows: SweepRow[] = [
    { k1: 1, b: 0, recall: 0.5, mrr: 0.5, ndcg: 0.5 },
    { k1: 1, b: 1, recall: 1, mrr: 0.5, ndcg: 0.5 },
    { k1: 2, b: 0, recall: 1, mrr: 0.8, ndcg: 0.7 },
  ];

  assert.deepEqual(bestRow(rows), rows[2]);
  assert.equal(bestRow([], 'recall'), undefined);
});
