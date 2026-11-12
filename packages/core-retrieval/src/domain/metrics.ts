function hitCount(retrieved: readonly string[], relevant: readonly string[], k: number): number {
  const top = new Set(retrieved.slice(0, k));
  let hits = 0;
  for (const id of relevant) {
    if (top.has(id)) hits += 1;
  }
  return hits;
}

export function recallAtK(retrieved: readonly string[], relevant: readonly string[], k: number): number {
  if (relevant.length === 0 || k <= 0) return 0;
  return hitCount(retrieved, relevant, k) / relevant.length;
}

export function precisionAtK(retrieved: readonly string[], relevant: readonly string[], k: number): number {
  if (k <= 0) return 0;
  return hitCount(retrieved, relevant, k) / k;
}

export function reciprocalRank(retrieved: readonly string[], relevant: readonly string[], k: number): number {
  const relevantSet = new Set(relevant);
  const limit = Math.min(k, retrieved.length);
  for (let i = 0; i < limit; i += 1) {
    const id = retrieved[i];
    if (id !== undefined && relevantSet.has(id)) return 1 / (i + 1);
  }
  return 0;
}

export function ndcgAtK(retrieved: readonly string[], relevant: readonly string[], k: number): number {
  if (relevant.length === 0 || k <= 0) return 0;
  const relevantSet = new Set(relevant);
  const limit = Math.min(k, retrieved.length);
  let dcg = 0;
  for (let i = 0; i < limit; i += 1) {
    const id = retrieved[i];
    if (id !== undefined && relevantSet.has(id)) dcg += 1 / Math.log2(i + 2);
  }
  const idealHits = Math.min(k, relevant.length);
  let idcg = 0;
  for (let i = 0; i < idealHits; i += 1) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
