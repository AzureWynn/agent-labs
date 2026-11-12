import { fileURLToPath } from 'node:url';
import { OllamaEmbeddingClient, resolveTimeoutMs } from '@agentlab/core-llm';
import type { Document } from '@agentlab/core-retrieval';
import { FsScenarioRepository } from '@agentlab/core-scenario';
import type { Scenario } from '@agentlab/core-scenario';
import { benchmarkIndexes, exactTopKSets, measureRecall } from './application/benchmark.js';
import type { IndexBenchmark } from './application/benchmark.js';
import {
  createSyntheticVectors,
  DEFAULT_SYNTHETIC_OPTIONS,
} from './application/synthetic-vectors.js';
import type { SyntheticVectorOptions } from './application/synthetic-vectors.js';
import type { VectorIndex } from './application/vector-index.js';
import { AnnoyVectorIndex } from './infrastructure/annoy-index.js';
import { ExactVectorIndex } from './infrastructure/exact-index.js';
import { FsJsonRunWriter } from './infrastructure/fs-json-run-writer.js';
import { HnswVectorIndex } from './infrastructure/hnsw-index.js';

type Mode = 'compare' | 'stress' | 'sweep';

interface AnnoySweepRow {
  readonly nTrees: number;
  readonly recallAtK: number;
  readonly misses: number;
}

interface HnswSweepRow {
  readonly efSearch: number;
  readonly recallAtK: number;
  readonly misses: number;
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function numberOption(name: string, fallback: number): number {
  const raw = option(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} 必须是数字`);
  return value;
}

function positiveIntegerOption(name: string, fallback: number): number {
  const value = numberOption(name, fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} 必须是正整数`);
  }
  return value;
}

function nonNegativeNumberOption(name: string, fallback: number): number {
  const value = numberOption(name, fallback);
  if (value < 0) throw new Error(`${name} 必须是非负数`);
  return value;
}

function parseMode(): Mode {
  const positional = process.argv[2];
  const raw = positional && !positional.startsWith('--') ? positional : option('--mode') ?? 'compare';
  if (raw === 'compare' || raw === 'stress' || raw === 'sweep') {
    return raw;
  }
  throw new Error(`mode 必须是 compare / stress / sweep，收到: ${raw}`);
}

function loadScenario(): Scenario {
  const scenarioName = option('--scenario') ?? 'property-notice-60';
  const scenariosDir = fileURLToPath(new URL('../../../scenarios/', import.meta.url));
  return new FsScenarioRepository(scenariosDir).load(scenarioName);
}

function createEmbeddingClient(): OllamaEmbeddingClient {
  const host = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model =
    process.env.OLLAMA_EMBED_MODEL ?? process.env.OLLAMA_MODEL ?? 'nomic-embed-text';
  return new OllamaEmbeddingClient({
    host,
    model,
    timeoutMs: resolveTimeoutMs(process.env.OLLAMA_TIMEOUT_MS),
  });
}

async function embedOrThrow(
  client: OllamaEmbeddingClient,
  texts: readonly string[],
  label: string,
): Promise<number[][]> {
  const host = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model =
    process.env.OLLAMA_EMBED_MODEL ?? process.env.OLLAMA_MODEL ?? 'nomic-embed-text';
  try {
    return await client.embed(texts);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${label}嵌入失败（${host}，模型 ${model}）。请确认 Ollama 已启动，且已执行 ollama pull ${model}。\n原始错误: ${reason}`,
    );
  }
}

function syntheticOptions(): SyntheticVectorOptions {
  return {
    count: positiveIntegerOption('--docs', DEFAULT_SYNTHETIC_OPTIONS.count),
    dimension: positiveIntegerOption('--dim', DEFAULT_SYNTHETIC_OPTIONS.dimension),
    clusters: positiveIntegerOption('--clusters', DEFAULT_SYNTHETIC_OPTIONS.clusters),
    noise: nonNegativeNumberOption('--noise', DEFAULT_SYNTHETIC_OPTIONS.noise),
    seed: positiveIntegerOption('--seed', DEFAULT_SYNTHETIC_OPTIONS.seed),
    queryCount: positiveIntegerOption('--queries', DEFAULT_SYNTHETIC_OPTIONS.queryCount),
  };
}

function docsFromVectors(vectors: readonly number[][]): Document[] {
  return vectors.map((_, index) => ({ id: `v${index}`, text: '' }));
}

function printBenchmarks(
  title: string,
  docs: number,
  queries: number,
  dimension: number,
  k: number,
  results: readonly IndexBenchmark[],
): void {
  console.log(`\n${title}`);
  console.log(`文档 ${docs}  查询 ${queries}  k=${k}  dim=${dimension}`);
  console.log('索引       建索引(ms)   单查询(ms)   Recall     miss');
  for (const result of results) {
    console.log(
      `${result.name.padEnd(8)} ${result.buildMs.toFixed(2).padStart(10)} ${result.queryMs.toFixed(3).padStart(11)} ${result.recallAtK.toFixed(3).padStart(9)} ${String(result.misses).padStart(6)}`,
    );
  }
}

function printSweep(
  title: string,
  annoyRows: readonly AnnoySweepRow[],
  hnswRows: readonly HnswSweepRow[],
  k: number,
): void {
  console.log(`\n${title}`);
  console.log(`\nANNOY: n_trees vs Recall@${k}`);
  console.log('n_trees    Recall     miss');
  for (const row of annoyRows) {
    console.log(
      `${String(row.nTrees).padStart(7)} ${row.recallAtK.toFixed(3).padStart(9)} ${String(row.misses).padStart(6)}`,
    );
  }
  console.log(`\nHNSW: ef_search vs Recall@${k}`);
  console.log('ef_search  Recall     miss');
  for (const row of hnswRows) {
    console.log(
      `${String(row.efSearch).padStart(9)} ${row.recallAtK.toFixed(3).padStart(9)} ${String(row.misses).padStart(6)}`,
    );
  }
}

function createIndexes(): VectorIndex[] {
  const nTrees = positiveIntegerOption('--n-trees', 50);
  const M = positiveIntegerOption('--M', 16);
  const efConstruction = positiveIntegerOption('--ef-construction', 200);
  const efSearch = positiveIntegerOption('--ef-search', 50);
  return [
    new ExactVectorIndex(),
    new AnnoyVectorIndex(nTrees),
    new HnswVectorIndex({ M, efConstruction, efSearch }),
  ];
}

async function runCompare(): Promise<void> {
  const scenario = loadScenario();
  const k = positiveIntegerOption('--k', 10);
  const label = option('--label') ?? 'dense-ann-compare';
  const queryTexts = Object.keys(scenario.labels);
  const client = createEmbeddingClient();

  const docVectors = await embedOrThrow(
    client,
    scenario.docs.map((doc) => doc.text),
    '文档',
  );
  const queryVectors = await embedOrThrow(client, queryTexts, '查询');
  if (docVectors.length !== scenario.docs.length) {
    throw new Error('文档嵌入数量与文档数量不一致');
  }
  if (queryVectors.length !== queryTexts.length) {
    throw new Error('查询嵌入数量与查询数量不一致');
  }

  const results = await benchmarkIndexes(
    scenario.docs,
    docVectors,
    queryVectors,
    k,
    createIndexes(),
  );
  printBenchmarks(
    `场景 ${scenario.name}`,
    scenario.docs.length,
    queryTexts.length,
    docVectors[0]?.length ?? 0,
    k,
    results,
  );

  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));
  const file = new FsJsonRunWriter(runsDir).write(scenario.name, label, {
    scenario: scenario.name,
    docs: scenario.docs.length,
    queries: queryTexts.length,
    k,
    dimension: docVectors[0]?.length ?? 0,
    indexes: results,
  });
  console.log(`\n原始结果: ${file}`);
}

async function runStress(): Promise<void> {
  const options = syntheticOptions();
  const k = positiveIntegerOption('--k', 10);
  const label = option('--label') ?? 'dense-ann-stress';
  const { vectors, queries } = createSyntheticVectors(options);
  const docs = docsFromVectors(vectors);

  const results = await benchmarkIndexes(docs, vectors, queries, k, createIndexes());
  printBenchmarks('合成向量', docs.length, queries.length, options.dimension, k, results);

  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));
  const file = new FsJsonRunWriter(runsDir).write('synthetic-vectors', label, {
    synthetic: options,
    k,
    indexes: results,
  });
  console.log(`\n原始结果: ${file}`);
}

async function runSweep(): Promise<void> {
  const options = syntheticOptions();
  const k = positiveIntegerOption('--k', 10);
  const label = option('--label') ?? 'dense-ann-sweep';
  const M = positiveIntegerOption('--M', 16);
  const efConstruction = positiveIntegerOption('--ef-construction', 200);
  const { vectors, queries } = createSyntheticVectors(options);
  const docs = docsFromVectors(vectors);
  const exactSets = exactTopKSets(docs, vectors, queries, k);

  const annoyRows: AnnoySweepRow[] = [];
  for (const nTrees of [1, 2, 5, 10, 50]) {
    const index = new AnnoyVectorIndex(nTrees);
    await index.build(vectors);
    const result = measureRecall(index, docs, queries, exactSets, k);
    annoyRows.push({ nTrees, recallAtK: result.recallAtK, misses: result.misses });
  }

  const hnswRows: HnswSweepRow[] = [];
  for (const efSearch of [1, 2, 5, 10, 50]) {
    const index = new HnswVectorIndex({ M, efConstruction, efSearch });
    await index.build(vectors);
    const result = measureRecall(index, docs, queries, exactSets, k);
    hnswRows.push({ efSearch, recallAtK: result.recallAtK, misses: result.misses });
  }

  printSweep('合成向量参数扫描', annoyRows, hnswRows, k);

  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));
  const file = new FsJsonRunWriter(runsDir).write('synthetic-vectors', label, {
    synthetic: options,
    k,
    params: { M, efConstruction },
    annoy: annoyRows,
    hnsw: hnswRows,
  });
  console.log(`\n原始结果: ${file}`);
}

async function main(): Promise<void> {
  const mode = parseMode();
  if (mode === 'compare') {
    await runCompare();
  } else if (mode === 'stress') {
    await runStress();
  } else {
    await runSweep();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
