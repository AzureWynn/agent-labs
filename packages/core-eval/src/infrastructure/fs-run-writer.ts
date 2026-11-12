import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunInput, RunWriter } from '../application/run-writer.js';

const SAFE_LABEL = /^[A-Za-z0-9_-]+$/;

export class FsRunWriter implements RunWriter {
  constructor(
    private readonly rootDir: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  write(input: RunInput): string {
    if (!SAFE_LABEL.test(input.label)) {
      throw new Error(`运行标签不合法: ${input.label}`);
    }
    const now = this.clock();
    const date = now.toISOString().slice(0, 10);
    const directory = join(this.rootDir, input.scenario, date);
    mkdirSync(directory, { recursive: true });
    const file = join(directory, `${input.label}.json`);
    if (existsSync(file)) {
      throw new Error(`运行文件已存在，请换一个 --label: ${file}`);
    }
    const payload = { generatedAt: now.toISOString(), ...input };
    writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return file;
  }
}
