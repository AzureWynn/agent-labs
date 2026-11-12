import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseScenario } from '../domain/scenario.js';
import type { Scenario } from '../domain/scenario.js';
import type { ScenarioRepository } from '../application/scenario-repository.js';

const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

export class FsScenarioRepository implements ScenarioRepository {
  constructor(private readonly rootDir: string) {}

  load(name: string): Scenario {
    if (!SAFE_NAME.test(name)) {
      throw new Error(`场景名不合法: ${name}`);
    }
    const file = join(this.rootDir, name, 'scenario.json');
    if (!existsSync(file)) {
      throw new Error(`场景不存在: ${name}（${file}）`);
    }
    const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return parseScenario(raw, file);
  }

  list(): string[] {
    if (!existsSync(this.rootDir)) return [];
    return readdirSync(this.rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(join(this.rootDir, name, 'scenario.json')))
      .sort();
  }
}
