import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FsRunWriter } from './fs-run-writer.js';

test('shouldWriteRunToScenarioAndDateDirectory', () => {
  const root = mkdtempSync(join(tmpdir(), 'runs-'));
  try {
    const writer = new FsRunWriter(root, () => new Date('2026-10-21T12:00:00Z'));
    const file = writer.write({
      scenario: 'property-notice',
      label: 'bm25',
      k: 3,
      methods: [],
    });
    assert.equal(file, join(root, 'property-notice', '2026-10-21', 'bm25.json'));
    const payload = JSON.parse(readFileSync(file, 'utf8')) as { scenario: string; k: number };
    assert.equal(payload.scenario, 'property-notice');
    assert.equal(payload.k, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shouldRejectOverwritingExistingRun', () => {
  const root = mkdtempSync(join(tmpdir(), 'runs-'));
  try {
    const writer = new FsRunWriter(root, () => new Date('2026-10-21T12:00:00Z'));
    const input = { scenario: 'property-notice', label: 'same', k: 3, methods: [] };
    writer.write(input);
    assert.throws(() => writer.write(input), /运行文件已存在/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shouldRejectUnsafeLabel', () => {
  const writer = new FsRunWriter(tmpdir());
  assert.throws(
    () => writer.write({ scenario: 'x', label: '../x', k: 1, methods: [] }),
    /运行标签不合法/,
  );
});
