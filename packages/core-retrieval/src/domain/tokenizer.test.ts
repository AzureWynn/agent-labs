import assert from 'node:assert/strict';
import test from 'node:test';
import { BookTokenizer } from './tokenizer.js';

test('shouldTokenizeEnglishAndDropStopwords', () => {
  const tokens = new BookTokenizer().tokenize('The BM25 ranking function is fast');
  assert.deepEqual(tokens, ['bm25', 'ranking', 'function', 'fast']);
});

test('shouldTokenizeChineseAsAdjacentBigrams', () => {
  const tokens = new BookTokenizer().tokenize('下水道堵塞');
  assert.deepEqual(tokens, ['下水', '水道', '道堵', '堵塞']);
});

test('shouldKeepDigitsInsideChineseText', () => {
  const tokens = new BookTokenizer().tokenize('3号楼下水道堵了');
  assert.ok(tokens.includes('3'));
  assert.ok(tokens.includes('下水'));
  assert.ok(tokens.includes('水道'));
});

test('shouldShareBigramsBetweenQueryAndDocument', () => {
  const tokenizer = new BookTokenizer();
  const query = new Set(tokenizer.tokenize('下水道返味'));
  const document = new Set(tokenizer.tokenize('地下管道返味'));
  assert.ok(query.has('返味'));
  assert.ok(document.has('返味'));
});

test('shouldLoseChineseWhenCjkBigramsDisabled', () => {
  const tokens = new BookTokenizer({ cjkBigrams: false }).tokenize('下水道堵塞');
  assert.deepEqual(tokens, []);
});
