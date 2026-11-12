import assert from 'node:assert/strict';
import test from 'node:test';
import type { EmbeddingClient } from '@agentlab/core-llm';
import type { Scenario } from '@agentlab/core-scenario';
import { embedScenario } from './embed-scenario.js';

const scenario: Scenario = {
  name: 'tiny',
  docs: [
    { id: 'd1', text: 'alpha' },
    { id: 'd2', text: 'beta' },
  ],
  labels: { alpha: ['d1'], beta: ['d2'] },
};

test('shouldEmbedDocumentsThenQueries', async () => {
  const calls: string[][] = [];
  const client: EmbeddingClient = {
    embed: async (texts) => {
      calls.push([...texts]);
      return texts.map((text) => [text.length, 1]);
    },
  };

  const vectors = await embedScenario(scenario, client);

  assert.deepEqual(calls, [
    ['alpha', 'beta'],
    ['alpha', 'beta'],
  ]);
  assert.equal(vectors.docVectors.length, 2);
  assert.deepEqual(vectors.queryVectors.get('alpha'), [5, 1]);
});

test('shouldRejectWhenDocumentVectorCountDiffers', async () => {
  const client: EmbeddingClient = {
    embed: async (texts) => texts.slice(0, 1).map(() => [1]),
  };

  await assert.rejects(() => embedScenario(scenario, client), /文档向量数量不一致/);
});
