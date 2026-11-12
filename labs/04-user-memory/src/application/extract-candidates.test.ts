import assert from 'node:assert/strict';
import test from 'node:test';
import { candidatesFromToolCalls } from './extract-candidates.js';

test('shouldParseObjectArguments', () => {
  const candidates = candidatesFromToolCalls([
    {
      name: 'add_memory',
      arguments: { content: '花花对鸡肉过敏', tags: ['健康'] },
    },
  ]);
  assert.deepEqual(candidates, [{ content: '花花对鸡肉过敏', tags: ['健康'] }]);
});

test('shouldParseJsonStringArguments', () => {
  const candidates = candidatesFromToolCalls([
    {
      name: 'add_memory',
      arguments: '{"content":"花花下次疫苗是5月10日","tags":["日程"]}',
    },
  ]);
  assert.deepEqual(candidates, [
    { content: '花花下次疫苗是5月10日', tags: ['日程'] },
  ]);
});

test('shouldIgnoreOtherToolsAndEmptyContent', () => {
  const candidates = candidatesFromToolCalls([
    { name: 'search_memory', arguments: { content: '花花' } },
    { name: 'add_memory', arguments: { content: '   ' } },
    { name: 'add_memory', arguments: { content: '用户电话是13800001111' } },
  ]);
  assert.deepEqual(candidates, [{ content: '用户电话是13800001111', tags: [] }]);
});

test('shouldFilterNonStringTags', () => {
  const candidates = candidatesFromToolCalls([
    {
      name: 'add_memory',
      arguments: { content: '用户住在3号楼2单元', tags: ['地址', 1, null, ''] },
    },
  ]);
  assert.deepEqual(candidates, [{ content: '用户住在3号楼2单元', tags: ['地址'] }]);
});
