import assert from 'node:assert/strict';
import test from 'node:test';
import { assertVectorDimension, validateVectors } from './vector-index.js';

test('shouldReturnVectorDimension', () => {
  assert.equal(validateVectors([[1, 2], [3, 4]]), 2);
});

test('shouldRejectEmptyVectors', () => {
  assert.throws(() => validateVectors([]), /不能为空/);
});

test('shouldRejectZeroDimension', () => {
  assert.throws(() => validateVectors([[]]), /维度不能为 0/);
});

test('shouldRejectMismatchedDimensions', () => {
  assert.throws(() => validateVectors([[1, 2], [3]]), /维度不一致/);
});

test('shouldRejectQueryWithWrongDimension', () => {
  assert.throws(() => assertVectorDimension([1], 2, '查询向量'), /维度不一致/);
});
