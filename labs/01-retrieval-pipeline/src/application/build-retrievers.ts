import type { Retriever } from '@agentlab/core-eval';
import {
  BM25Index,
  BookTokenizer,
  DenseIndex,
  rerank,
  rrfFuse,
  weightedFuse,
} from '@agentlab/core-retrieval';
import type { ScoredDocument } from '@agentlab/core-retrieval';
import type { Scenario, ScenarioDocument } from '@agentlab/core-scenario';

export interface RetrievalOptions {
  readonly candidatePool: number;
  readonly rrfK: number;
  readonly denseWeight: number;
  readonly sparseWeight: number;
  readonly rerankTopK: number;
}

export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  candidatePool: 20,
  rrfK: 60,
  denseWeight: 0.5,
  sparseWeight: 0.5,
  rerankTopK: 10,
};

export interface RetrievalInputs {
  readonly scenario: Scenario;
  readonly docVectors: readonly (readonly number[])[];
  readonly queryVectors: ReadonlyMap<string, readonly number[]>;
  readonly options?: Partial<RetrievalOptions>;
}

export function createRetrievers(inputs: RetrievalInputs): Retriever[] {
  const options: RetrievalOptions = { ...DEFAULT_RETRIEVAL_OPTIONS, ...inputs.options };
  const tokenizer = new BookTokenizer();
  const bm25 = new BM25Index(inputs.scenario.docs, tokenizer);
  const dense = new DenseIndex(inputs.scenario.docs, inputs.docVectors);
  const docsById = new Map(inputs.scenario.docs.map((doc) => [doc.id, doc]));

  const sparseList = (query: string): ScoredDocument[] =>
    bm25.search(query, options.candidatePool);

  const denseList = (query: string): ScoredDocument[] => {
    const vector = inputs.queryVectors.get(query);
    if (!vector) throw new Error(`缺少查询向量: ${query}`);
    return dense.search(vector, options.candidatePool);
  };

  const rrfList = (query: string): ScoredDocument[] =>
    rrfFuse([sparseList(query), denseList(query)], options.rrfK);

  const weightedList = (query: string): ScoredDocument[] =>
    weightedFuse(
      denseList(query),
      sparseList(query),
      options.denseWeight,
      options.sparseWeight,
    );

  const ids = (docs: readonly ScoredDocument[], k: number): string[] =>
    docs.slice(0, k).map((doc) => doc.id);

  return [
    { name: 'BM25', search: (query, k) => ids(sparseList(query), k) },
    { name: 'Dense', search: (query, k) => ids(denseList(query), k) },
    { name: 'Hybrid-RRF', search: (query, k) => ids(rrfList(query), k) },
    { name: 'Hybrid-Weighted', search: (query, k) => ids(weightedList(query), k) },
    {
      name: 'Hybrid-RRF+Rerank',
      search: (query, k) => {
        const candidates = rrfList(query).slice(0, options.rerankTopK);
        const candidateDocs = candidates
          .map((candidate) => docsById.get(candidate.id))
          .filter((doc): doc is ScenarioDocument => doc !== undefined);
        const fusedRank = new Map(
          candidates.map((candidate, index) => [candidate.id, index]),
        );
        return ids(rerank(query, candidateDocs, fusedRank, tokenizer), k);
      },
    },
  ];
}
