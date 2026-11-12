import type { ScoredDocument } from './types.js';

function minMaxNormalize(list: readonly ScoredDocument[]): Map<string, number> {
  const normalized = new Map<string, number>();
  if (list.length === 0) return normalized;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const doc of list) {
    if (doc.score < min) min = doc.score;
    if (doc.score > max) max = doc.score;
  }
  const range = max - min;
  for (const doc of list) {
    normalized.set(doc.id, range > 0 ? (doc.score - min) / range : 1);
  }
  return normalized;
}

export function rrfFuse(
  lists: readonly (readonly ScoredDocument[])[],
  k = 60,
): ScoredDocument[] {
  const scores = new Map<string, { score: number; text: string }>();
  for (const list of lists) {
    list.forEach((doc, index) => {
      const entry = scores.get(doc.id) ?? { score: 0, text: doc.text };
      entry.score += 1 / (k + index + 1);
      scores.set(doc.id, entry);
    });
  }
  return [...scores.entries()]
    .map(([id, entry]) => ({ id, text: entry.text, score: entry.score }))
    .sort((left, right) => right.score - left.score);
}

export function weightedFuse(
  dense: readonly ScoredDocument[],
  sparse: readonly ScoredDocument[],
  denseWeight = 0.5,
  sparseWeight = 0.5,
): ScoredDocument[] {
  const denseScores = minMaxNormalize(dense);
  const sparseScores = minMaxNormalize(sparse);
  const texts = new Map<string, string>();
  for (const doc of [...dense, ...sparse]) texts.set(doc.id, doc.text);

  const ids = new Set([...denseScores.keys(), ...sparseScores.keys()]);
  return [...ids]
    .map((id) => ({
      id,
      text: texts.get(id) ?? '',
      score: denseWeight * (denseScores.get(id) ?? 0) + sparseWeight * (sparseScores.get(id) ?? 0),
    }))
    .sort((left, right) => right.score - left.score);
}
