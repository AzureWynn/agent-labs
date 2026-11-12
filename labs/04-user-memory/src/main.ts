import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateMemoryBenchmark } from './application/benchmark.js';
import {
  extractScenario,
  type ExtractionFixture,
} from './application/extract-candidates.js';
import { parseMemoryScenario } from './domain/memory-scenario.js';
import { FsJsonRunWriter } from './infrastructure/fs-json-run-writer.js';
import { OllamaChatClient } from './infrastructure/ollama-chat-client.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function positiveIntegerOption(name: string, fallback: number): number {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return value;
}

function loadScenario() {
  const path = fileURLToPath(
    new URL('../../../scenarios/pet-clinic-memory/scenario.json', import.meta.url),
  );
  return parseMemoryScenario(JSON.parse(readFileSync(path, 'utf8')));
}

function fixturePath(): string {
  return (
    option('--fixture') ??
    fileURLToPath(new URL('../fixtures/pet-clinic-memory-gemma4.json', import.meta.url))
  );
}

function loadFixture(path: string): ExtractionFixture {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as ExtractionFixture;
  if (!Array.isArray(fixture.rounds)) {
    throw new Error(`${path} 的 rounds 必须是数组`);
  }
  return fixture;
}

async function runExtract(): Promise<void> {
  const scenario = loadScenario();
  const path = fixturePath();
  const force = process.argv.includes('--force');

  if (existsSync(path) && !force) {
    throw new Error(`fixture 已存在，不覆盖（加 --force 重跑）：${path}`);
  }

  const host = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model =
    process.env.OLLAMA_CHAT_MODEL ?? process.env.OLLAMA_MODEL ?? 'gemma4:latest';
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);
  const concurrency = positiveIntegerOption('--concurrency', 4);
  const batchSize = positiveIntegerOption('--batch-size', 5);

  console.log(`场景 ${scenario.name}  用户 ${scenario.users.length}  模型 ${model}`);
  console.log(`并发 ${concurrency}  每批 ${batchSize} 轮  输出 ${path}\n`);

  const client = new OllamaChatClient({ host, model, timeoutMs });
  const fixture = await extractScenario(scenario, client, {
    model,
    concurrency,
    batchSize,
    log: (message) => console.log(message),
  });

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  const totalCandidates = fixture.rounds.reduce(
    (total, round) => total + round.candidates.length,
    0,
  );
  console.log(`\n完成：${fixture.rounds.length} 轮，${totalCandidates} 条候选`);
  console.log(`fixture: ${path}`);
}

function runBenchmark(): void {
  const scenario = loadScenario();
  const path = fixturePath();
  if (!existsSync(path)) {
    throw new Error(`找不到 fixture：${path}。先运行 npm run extract。`);
  }
  const fixture = loadFixture(path);
  const report = evaluateMemoryBenchmark(scenario, fixture);
  const label = option('--label') ?? 'memory-gemma4';
  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));
  const file = new FsJsonRunWriter(runsDir).write(scenario.name, label, { ...report });

  console.log(`\n场景 ${report.scenario}  模型 ${report.model}`);
  console.log('用户  轮次  原始候选  去重后  重复率  Recall@1  Recall@3');
  for (const user of report.users) {
    console.log(
      `${user.userId.padEnd(5)} ${String(user.rounds).padStart(4)} ${String(
        user.rawCandidates,
      ).padStart(9)} ${String(user.unique).padStart(7)} ${user.duplicateRate
        .toFixed(3)
        .padStart(7)} ${user.recallAt1.toFixed(3).padStart(9)} ${user.recallAt3
        .toFixed(3)
        .padStart(9)}`,
    );
  }
  const totals = report.totals;
  console.log(
    `合计  ${String(totals.rounds).padStart(4)} ${String(totals.rawCandidates).padStart(
      9,
    )} ${String(totals.unique).padStart(7)} ${totals.duplicateRate
      .toFixed(3)
      .padStart(7)} ${totals.recallAt1.toFixed(3).padStart(9)} ${totals.recallAt3
      .toFixed(3)
      .padStart(9)}`,
  );

  console.log(
    `对照：规范事实 Recall@1 ${totals.canonicalRecallAt1.toFixed(3)}  Recall@3 ${totals.canonicalRecallAt3.toFixed(3)}`,
  );

  const misses = report.users.flatMap((user) =>
    user.queries
      .filter((query) => query.rank !== 0)
      .map((query) => ({ userId: user.userId, ...query })),
  );
  if (misses.length > 0) {
    console.log('\n未命中 @1：');
    for (const miss of misses) {
      console.log(`${miss.userId} ${miss.query} rank=${miss.rank} top=${miss.top[0] ?? ''}`);
    }
  }

  console.log(`\n原始结果: ${file}`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'benchmark';
  if (command === 'extract') {
    await runExtract();
    return;
  }
  if (command === 'benchmark') {
    runBenchmark();
    return;
  }
  throw new Error(`未知命令：${command}（可用 extract / benchmark）`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
