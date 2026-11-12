import { mean, ndcgAtK, precisionAtK, recallAtK, reciprocalRank } from '@agentlab/core-retrieval';
import type { Scenario } from '@agentlab/core-scenario';

export interface Retriever {
  readonly name: string;
  search(query: string, k: number): string[];
}

export interface QueryOutcome {
  readonly query: string;
  readonly relevant: readonly string[];
  readonly retrieved: readonly string[];
  readonly recall: number;
  readonly precision: number;
  readonly reciprocalRank: number;
  readonly ndcg: number;
}

export interface MethodOutcome {
  readonly method: string;
  readonly k: number;
  readonly recall: number;
  readonly precision: number;
  readonly mrr: number;
  readonly ndcg: number;
  readonly queries: readonly QueryOutcome[];
}

export function evaluate(
  scenario: Scenario,
  retrievers: readonly Retriever[],
  k: number,
): MethodOutcome[] {
  if (k <= 0) {
    throw new Error('k 必须大于 0');
  }

  return retrievers.map((retriever) => {
    const queries = Object.entries(scenario.labels).map(([query, relevant]) => {
      const retrieved = retriever.search(query, k);
      return {
        query,
        relevant,
        retrieved,
        recall: recallAtK(retrieved, relevant, k),
        precision: precisionAtK(retrieved, relevant, k),
        reciprocalRank: reciprocalRank(retrieved, relevant, k),
        ndcg: ndcgAtK(retrieved, relevant, k),
      };
    });

    return {
      method: retriever.name,
      k,
      recall: mean(queries.map((query) => query.recall)),
      precision: mean(queries.map((query) => query.precision)),
      mrr: mean(queries.map((query) => query.reciprocalRank)),
      ndcg: mean(queries.map((query) => query.ndcg)),
      queries,
    };
  });
}
