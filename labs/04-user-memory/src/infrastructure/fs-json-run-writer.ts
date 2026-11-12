import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAFE_LABEL = /^[A-Za-z0-9_-]+$/;

export class FsJsonRunWriter {
  constructor(
    private readonly rootDir: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  write(scenario: string, label: string, payload: Record<string, unknown>): string {
    if (!SAFE_LABEL.test(label)) {
      throw new Error(`运行标签不合法: ${label}`);
    }
    const now = this.clock();
    const directory = join(this.rootDir, scenario, now.toISOString().slice(0, 10));
    mkdirSync(directory, { recursive: true });
    const file = join(directory, `${label}.json`);
    if (existsSync(file)) {
      throw new Error(`运行文件已存在，请换一个 --label: ${file}`);
    }
    const content = { generatedAt: now.toISOString(), ...payload };
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
    return file;
  }
}
