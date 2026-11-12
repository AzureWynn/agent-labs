import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOpenAiBaseUrl, resolveTimeoutMs } from './endpoint.js';

test('shouldAppendV1WhenMissing', () => {
  assert.equal(normalizeOpenAiBaseUrl('http://localhost:11434'), 'http://localhost:11434/v1');
});

test('shouldNotDuplicateV1OrTrailingSlash', () => {
  assert.equal(normalizeOpenAiBaseUrl('http://localhost:11434/'), 'http://localhost:11434/v1');
  assert.equal(normalizeOpenAiBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.equal(normalizeOpenAiBaseUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
});

test('shouldRejectEmptyBaseUrl', () => {
  assert.throws(() => normalizeOpenAiBaseUrl('   '), /baseURL 不能为空/);
});

test('shouldResolveTimeoutWithDefault', () => {
  assert.equal(resolveTimeoutMs(undefined), 240_000);
  assert.equal(resolveTimeoutMs('5000'), 5000);
});

test('shouldRejectInvalidTimeout', () => {
  assert.throws(() => resolveTimeoutMs('0'), /超时时间不合法/);
  assert.throws(() => resolveTimeoutMs('abc'), /超时时间不合法/);
});
