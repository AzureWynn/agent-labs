import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FsScenarioRepository } from './fs-scenario-repository.js';

test('shouldLoadScenarioAndListOnlyValidDirectories', () => {
  const root = mkdtempSync(join(tmpdir(), 'scenario-'));
  try {
    mkdirSync(join(root, 'demo'));
    mkdirSync(join(root, 'empty'));
    writeFileSync(
      join(root, 'demo', 'scenario.json'),
      JSON.stringify({
        name: 'demo',
        docs: [{ id: 'a', text: 'alpha' }],
        labels: { alpha: ['a'] },
      }),
    );

    const repository = new FsScenarioRepository(root);
    assert.equal(repository.load('demo').name, 'demo');
    assert.deepEqual(repository.list(), ['demo']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shouldRejectPathTraversalInScenarioName', () => {
  const repository = new FsScenarioRepository(tmpdir());
  assert.throws(() => repository.load('../etc'), /场景名不合法/);
});
