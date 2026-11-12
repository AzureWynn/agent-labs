import { evaluate } from '@agentlab/core-eval';
import type { Scenario } from '@agentlab/core-scenario';
import { createBm25Index, createBm25Retriever } from './build-bm25.js';

export interface SweepRow {
  readonly k1: number;
  readonly b: number;
  readonly recall: number;
  readonly mrr: number;
  readonly ndcg: number;
}

export interface SweepOptions {
  readonly k1Values: readonly number[];
  readonly bValues: readonly number[];
  readonly k: number;
}

export const DEFAULT_SWEEP: SweepOptions = {
  k1Values: [0.5, 1.0, 1.5, 2.0],
  bValues: [0, 0.25, 0.5, 0.75, 1.0],
  k: 5,
};

export function sweepBm25(
  scenario: Scenario,
  options: SweepOptions = DEFAULT_SWEEP,
): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const k1 of options.k1Values) {
    for (const b of options.bValues) {
      const index = createBm25Index(scenario, { k1, b });
      const [outcome] = evaluate(
        scenario,
        [createBm25Retriever(index)],
        options.k,
      );
      if (!outcome) continue;
      rows.push({
        k1,
        b,
        recall: outcome.recall,
        mrr: outcome.mrr,
        ndcg: outcome.ndcg,
      });
    }
  }
  return rows;
}

export function bestRow(
  rows: readonly SweepRow[],
  metric: 'recall' | 'mrr' | 'ndcg' = 'recall',
): SweepRow | undefined {
  return rows.reduce<SweepRow | undefined>((best, row) => {
    if (!best) return row;
    if (row[metric] > best[metric]) return row;
    if (row[metric] === best[metric] && row.mrr > best.mrr) return row;
    return best;
  }, undefined);
}
