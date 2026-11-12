import { fileURLToPath } from 'node:url';
import { FsRunWriter, runEval } from '@agentlab/core-eval';
import { OllamaEmbeddingClient, resolveTimeoutMs } from '@agentlab/core-llm';
import { FsScenarioRepository } from '@agentlab/core-scenario';
import { createRetrievers, DEFAULT_RETRIEVAL_OPTIONS } from './application/build-retrievers.js';
import { embedScenario } from './application/embed-scenario.js';

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

async function main(): Promise<void> {
  const scenarioName = option('--scenario') ?? 'property-notice';
  const k = positiveIntegerOption('--k', 3);
  const label = option('--label') ?? 'five-methods';
  const candidatePool = positiveIntegerOption(
    '--candidate-pool',
    DEFAULT_RETRIEVAL_OPTIONS.candidatePool,
  );
  const rrfK = positiveIntegerOption('--rrf-k', DEFAULT_RETRIEVAL_OPTIONS.rrfK);
  const rerankTopK = positiveIntegerOption(
    '--rerank-top-k',
    DEFAULT_RETRIEVAL_OPTIONS.rerankTopK,
  );

  const scenariosDir = fileURLToPath(new URL('../../../scenarios/', import.meta.url));
  const runsDir = fileURLToPath(new URL('../runs/', import.meta.url));

  const repository = new FsScenarioRepository(scenariosDir);
  const scenario = repository.load(scenarioName);

  const host = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const model =
    process.env.OLLAMA_EMBED_MODEL ?? process.env.OLLAMA_MODEL ?? 'nomic-embed-text';
  const embeddingClient = new OllamaEmbeddingClient({
    host,
    model,
    timeoutMs: resolveTimeoutMs(process.env.OLLAMA_TIMEOUT_MS),
  });

  const vectors = await embedScenario(scenario, embeddingClient).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `嵌入失败（${host}，模型 ${model}）。请确认 Ollama 已启动，且已执行 ollama pull ${model}。\n原始错误: ${reason}`,
    );
  });

  const retrievers = createRetrievers({
    scenario,
    docVectors: vectors.docVectors,
    queryVectors: vectors.queryVectors,
    options: { candidatePool, rrfK, rerankTopK },
  });

  const { methods, file } = runEval({
    scenario,
    retrievers,
    k,
    label,
    writer: new FsRunWriter(runsDir),
  });

  console.log(
    `\n场景 ${scenario.name}  文档 ${scenario.docs.length}  查询 ${Object.keys(scenario.labels).length}  k=${k}  候选 ${candidatePool}`,
  );
  console.log('\n方法                     Recall       MRR      nDCG');
  for (const method of methods) {
    console.log(
      `${method.method.padEnd(22)} ${method.recall.toFixed(4).padStart(7)} ${method.mrr
        .toFixed(4)
        .padStart(8)} ${method.ndcg.toFixed(4).padStart(8)}`,
    );
  }
  if (file) {
    console.log(`\n原始结果: ${file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
