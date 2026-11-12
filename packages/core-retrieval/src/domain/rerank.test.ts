import assert from 'node:assert/strict';
import test from 'node:test';
import { rerank } from './rerank.js';
import { BookTokenizer } from './tokenizer.js';
import type { Document } from './types.js';

const tokenizer = new BookTokenizer();

test('shouldRewardQueryTermCoverage', () => {
  const docs: Document[] = [
    { id: 'd1', text: '电梯运行时异响，已派单' },
    { id: 'd2', text: '地下车库照明故障' },
  ];
  const ranked = rerank('电梯异响', docs, new Map([['d1', 0], ['d2', 1]]), tokenizer);

  assert.deepEqual(ranked.map((item) => item.id), ['d1', 'd2']);
  assert.equal(ranked[0]?.baseScore, 1);
  assert.ok((ranked[0]?.coverageBonus ?? 0) > 0);
});

test('shouldRewardContiguousChinesePhrase', () => {
  const docs: Document[] = [{ id: 'd1', text: '厨房下水道堵塞，已安排疏通' }];
  const [ranked] = rerank('下水道堵塞', docs, new Map([['d1', 0]]), tokenizer);

  assert.equal(ranked?.phraseBonus, 0.5);
  assert.equal(ranked?.coverageBonus, 0.5);
});

test('shouldNotMatchPhraseInsideLatinWord', () => {
  const docs: Document[] = [{ id: 'd1', text: 'concatenate strings' }];
  const [ranked] = rerank('cat', docs, new Map([['d1', 0]]), tokenizer);

  assert.equal(ranked?.phraseBonus, 0);
});

test('shouldFallBackToLastRankWhenDocumentIsMissingFromFusion', () => {
  const docs: Document[] = [
    { id: 'd1', text: 'alpha' },
    { id: 'd2', text: 'beta' },
  ];
  const ranked = rerank('alpha', docs, new Map([['d1', 0]]), tokenizer);
  const missing = ranked.find((item) => item.id === 'd2');

  assert.equal(missing?.baseScore, 1 / 3);
});
