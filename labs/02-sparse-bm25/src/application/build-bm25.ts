import type { Retriever } from '@agentlab/core-eval';
import { BM25Index, BookTokenizer } from '@agentlab/core-retrieval';
import type { Scenario } from '@agentlab/core-scenario';

export interface Bm25Config {
  readonly k1: number;
  readonly b: number;
}

export function createBm25Index(scenario: Scenario, config: Bm25Config): BM25Index {
  return new BM25Index(scenario.docs, new BookTokenizer(), { k1: config.k1, b: config.b });
}

export function createBm25Retriever(index: BM25Index, name = 'BM25'): Retriever {
  return {
    name,
    search: (query: string, k: number) => index.search(query, k).map((doc) => doc.id),
  };
}
