import assert from 'node:assert/strict';
import test from 'node:test';
import { BM25Index } from './bm25.js';
import { BookTokenizer } from './tokenizer.js';
import type { Document } from './types.js';

const DOCS: readonly Document[] = [
  { id: 'distill', text: 'Model distillation compresses a large teacher into a small student.' },
  { id: 'http', text: 'An HTTP 404 error means the requested resource was not found.' },
  { id: 'bm25', text: 'BM25 scores documents with term frequency and inverse document frequency.' },
  { id: 'kitten', text: 'A kitten is playing with a ball of yarn.' },
  { id: 'feline', text: 'Feline behavior research covers grooming and sleep cycles.' },
];

test('shouldRankExactKeywordFirst', () => {
  const index = new BM25Index(DOCS, new BookTokenizer());
  assert.equal(index.search('BM25 ranking', 1)[0]?.id, 'bm25');
});

test('shouldMatchChineseQueryAgainstChineseDocument', () => {
  const docs: Document[] = [
    { id: 't1', text: '工单：3号楼2单元厨房下水道堵塞，维修工张伟已疏通。' },
    { id: 't2', text: '工单：1号楼电梯运行异响，待安达电梯处理。' },
  ];
  const index = new BM25Index(docs, new BookTokenizer());
  assert.equal(index.search('3号楼下水道堵了', 1)[0]?.id, 't1');
});

test('shouldMissSynonymWhenSurfaceFormsDiffer', () => {
  const index = new BM25Index(DOCS, new BookTokenizer());
  assert.equal(index.search('cat', 5).length, 0);
});

test('shouldReturnEmptyWhenQueryHasNoKnownTerm', () => {
  const index = new BM25Index(DOCS, new BookTokenizer());
  assert.deepEqual(index.search('quantum', 5), []);
});

test('shouldExposeVocabularySize', () => {
  const index = new BM25Index(DOCS, new BookTokenizer());
  assert.ok(index.vocabularySize() > 10);
});

test('shouldNotDoubleCountRepeatedQueryTerms', () => {
  const index = new BM25Index([{ id: 'd1', text: 'alpha beta' }], new BookTokenizer());
  const once = index.search('alpha', 1)[0]?.score;
  const twice = index.search('alpha alpha', 1)[0]?.score;
  assert.equal(twice, once);
});

test('shouldExplainPerTermContribution', () => {
  const docs: Document[] = [
    { id: 'd1', text: 'alpha beta alpha' },
    { id: 'd2', text: 'gamma' },
  ];
  const index = new BM25Index(docs, new BookTokenizer());
  const explanation = index.explain('alpha', 'd1');

  assert.equal(explanation.docId, 'd1');
  assert.equal(explanation.documentLength, 3);
  assert.equal(explanation.terms.length, 1);
  assert.equal(explanation.terms[0]?.term, 'alpha');
  assert.equal(explanation.terms[0]?.termFrequency, 2);
  assert.equal(explanation.terms[0]?.documentFrequency, 1);
  assert.equal(explanation.score, explanation.terms[0]?.contribution);
  assert.throws(() => index.explain('alpha', 'missing'), /文档不存在/);
});

test('shouldExposePostingList', () => {
  const docs: Document[] = [
    { id: 'd1', text: 'alpha alpha beta' },
    { id: 'd2', text: 'alpha' },
  ];
  const index = new BM25Index(docs, new BookTokenizer());

  assert.deepEqual(index.postingList('alpha'), [
    { docId: 'd1', tf: 2 },
    { docId: 'd2', tf: 1 },
  ]);
  assert.deepEqual(index.postingList('unknown'), []);
});
