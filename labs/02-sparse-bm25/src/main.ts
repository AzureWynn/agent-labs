import { fileURLToPath } from 'node:url';
import { FsRunWriter, runEval } from '@agentlab/core-eval';
import { BookTokenizer } from '@agentlab/core-retrieval';
import { FsScenarioRepository } from '@agentlab/core-scenario';
import type { Scenario } from '@agentlab/core-scenario';
import { createBm25Index, createBm25Retriever } from './application/build-bm25.js';
import { bestRow, DEFAULT_SWEEP, sweepBm25 } from './application/sweep.js';
import type { SweepRow } from './application/sweep.js';

type Mode = 'demo' | 'explain' | 'eval' | 'sweep';

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
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} 必须是正整数`);
  return value;
}

function parseMode(): Mode {
  const raw = option('--mode') ?? 'demo';
  if (raw === 'demo' || raw === 'explain' || raw === 'eval' || raw === 'sweep') {
    return raw;
  }
  throw new Error(`--mode 必须是 demo / explain / eval / sweep，收到: ${raw}`);
}

function loadScenario(): Scenario {
  const scenariosDir = fileURLToPath(new URL('../../../scenarios/', import.meta.url));
  return new FsScenarioRepository(scenariosDir).load(option('--scenario') ?? 'property-notice');
}

function defaultQuery(scenario: Scenario): string {
  const query = Object.keys(scenario.labels)[0];
  if (!query) throw new Error('场景没有查询');
  return query;
}

function formatTokens(tokens: readonly string[]): string {
  return `[${tokens.join(', ')}]`;
}

function runDemo(scenario: Scenario): void {
  const k1 = numberOption('--k1', 1.5);
  const b = numberOption('--b', 0.75);
  const topK = positiveIntegerOption('--top-k', 5);
  const query = option('--query') ?? defaultQuery(scenario);
  const gapQuery = option('--gap-query') ?? '污水倒灌';
  const term = option('--term') ?? '下水';

  const index = createBm25Index(scenario, { k1, b });
  const tokenizer = new BookTokenizer();

  console.log(
    `\n场景 ${scenario.name}  文档 ${scenario.docs.length}  词表 ${index.vocabularySize()}  avgdl ${index.avgdl.toFixed(2)}  k1=${k1} b=${b}`,
  );
  console.log(`\n查询 "${query}"`);
  console.log(`tokens: ${formatTokens(tokenizer.tokenize(query))}`);
  const results = index.search(query, topK);
  if (results.length === 0) {
    console.log('  无命中');
  } else {
    for (const doc of results) {
      const explanation = index.explain(query, doc.id);
      console.log(
        `  ${doc.id}  score=${explanation.score.toFixed(4)}  len=${explanation.documentLength}  matched=${formatTokens(explanation.terms.map((item) => item.term))}`,
      );
      console.log(`    ${doc.text.slice(0, 80)}`);
    }
  }

  console.log(`\n同义词缺口: "${gapQuery}"`);
  console.log(`tokens: ${formatTokens(tokenizer.tokenize(gapQuery))}`);
  const gapResults = index.search(gapQuery, topK);
  if (gapResults.length === 0) {
    console.log('  无命中：查询词与任何文档都没有字面交集');
  } else {
    for (const doc of gapResults) {
      console.log(`  ${doc.id}  score=${doc.score.toFixed(4)}  ${doc.text.slice(0, 60)}`);
    }
  }

  console.log(`\n倒排表 "${term}"（中文按相邻二元组切词）`);
  const postings = index.postingList(term);
  if (postings.length === 0) {
    console.log('  （空）');
  } else {
    for (const posting of postings) {
      console.log(`  ${posting.docId}  tf=${posting.tf}`);
    }
  }
}

function runExplain(scenario: Scenario): void {
  const k1 = numberOption('--k1', 1.5);
  const b = numberOption('--b', 0.75);
  const topK = positiveIntegerOption('--top-k', 5);
  const query = option('--query') ?? defaultQuery(scenario);
  const index = createBm25Index(scenario, { k1, b });
  const tokenizer = new BookTokenizer();
  const tokens = tokenizer.tokenize(query);

  console.log(`\nExplain: "${query}" (k1=${k1}, b=${b})`);
  console.log(`Query tokens: ${formatTokens(tokens)}`);
  for (const term of new Set(tokens)) {
    console.log(
      `  term "${term}": df=${index.documentFrequency(term)}, idf=${index.idf(term).toFixed(4)}, posting=${JSON.stringify(index.postingList(term))}`,
    );
  }

  const results = index.search(query, topK);
  if (results.length === 0) {
    console.log('\n  无命中');
    return;
  }
  for (const doc of results) {
    const explanation = index.explain(query, doc.id);
    console.log(
      `\n  ${explanation.docId}  total=${explanation.score.toFixed(4)}  len=${explanation.documentLength}`,
    );
    for (const term of explanation.terms) {
      console.log(
        `    ${term.term}: tf=${term.termFrequency} df=${term.documentFrequency} idf=${term.idf.toFixed(4)} contribution=${term.contribution.toFixed(4)}`,
      );
    }
  }
}

function runEvalMode(scenario: Scenario): void {
  const k = positiveIntegerOption('--k', 5);
  const k1 = numberOption('--k1', 1.5);
  const b = numberOption('--b', 0.75);
  const label = option('--label') ?? 'sparse-bm25';
  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));

  const index = createBm25Index(scenario, { k1, b });
  const { methods, file } = runEval({
    scenario,
    retrievers: [createBm25Retriever(index)],
    k,
    label,
    writer: new FsRunWriter(runsDir),
  });
  const outcome = methods[0];
  if (!outcome) throw new Error('评估结果为空');

  console.log(`\nBM25 eval  k=${k}  k1=${k1}  b=${b}`);
  for (const query of outcome.queries) {
    const mark = query.recall === 0 ? '  <- miss' : '';
    console.log(
      `query '${query.query}'  recall@${k}=${query.recall.toFixed(3)}  precision@${k}=${query.precision.toFixed(3)}  RR=${query.reciprocalRank.toFixed(3)}  nDCG@${k}=${query.ndcg.toFixed(3)}${mark}`,
    );
  }
  console.log(
    `macro avg  recall@${k}=${outcome.recall.toFixed(3)}  precision@${k}=${outcome.precision.toFixed(3)}  MRR=${outcome.mrr.toFixed(3)}  nDCG@${k}=${outcome.ndcg.toFixed(3)}`,
  );
  if (file) console.log(`\n原始结果: ${file}`);
}

function printGrid(title: string, rows: readonly SweepRow[], metric: 'recall' | 'mrr'): void {
  const { k1Values, bValues } = DEFAULT_SWEEP;
  console.log(`\n${title}`);
  console.log(['k1\\b', ...bValues.map((b) => b.toFixed(2).padStart(6))].join(' '));
  for (const k1 of k1Values) {
    const cells = bValues.map((b) => {
      const row = rows.find((item) => item.k1 === k1 && item.b === b);
      return (row?.[metric] ?? 0).toFixed(3).padStart(6);
    });
    console.log([k1.toFixed(2).padStart(4), ...cells].join(' '));
  }
}

function runSweepMode(scenario: Scenario): void {
  const k = positiveIntegerOption('--k', DEFAULT_SWEEP.k);
  const rows = sweepBm25(scenario, { ...DEFAULT_SWEEP, k });

  console.log(`\nBM25 sweep  k=${k}`);
  printGrid(`Recall@${k}`, rows, 'recall');
  printGrid('MRR', rows, 'mrr');

  const best = bestRow(rows);
  if (best) {
    console.log(
      `\nbest: k1=${best.k1} b=${best.b}  recall=${best.recall.toFixed(3)}  MRR=${best.mrr.toFixed(3)}  nDCG=${best.ndcg.toFixed(3)}`,
    );
  }
  const distinct = [...new Set(rows.map((row) => row.recall.toFixed(3)))];
  console.log(`Recall 取值: ${distinct.join(', ')}`);
}

function main(): void {
  const mode = parseMode();
  const scenario = loadScenario();
  switch (mode) {
    case 'explain':
      runExplain(scenario);
      break;
    case 'eval':
      runEvalMode(scenario);
      break;
    case 'sweep':
      runSweepMode(scenario);
      break;
    case 'demo':
    default:
      runDemo(scenario);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
