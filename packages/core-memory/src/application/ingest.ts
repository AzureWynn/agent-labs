import type { MemoryCandidate } from '../domain/memory.js';
import type { MemoryStore } from '../domain/memory-store.js';

export interface IngestStats {
  readonly raw: number;
  readonly added: number;
  readonly mergedExact: number;
  readonly mergedNear: number;
  readonly unique: number;
}

export function ingestCandidates(
  store: MemoryStore,
  candidates: readonly MemoryCandidate[],
): IngestStats {
  let added = 0;
  let mergedExact = 0;
  let mergedNear = 0;

  for (const candidate of candidates) {
    const result = store.add(candidate);
    if (result.outcome === 'added') added += 1;
    else if (result.outcome === 'exact') mergedExact += 1;
    else mergedNear += 1;
  }

  return {
    raw: candidates.length,
    added,
    mergedExact,
    mergedNear,
    unique: store.size,
  };
}

export function duplicateRate(stats: IngestStats): number {
  if (stats.raw === 0) return 0;
  return (stats.mergedExact + stats.mergedNear) / stats.raw;
}
