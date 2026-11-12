import type { MemoryItem } from './memory.js';
import { contentTokenSet, normalizeContent, queryTokens } from './dedup.js';

export function scoreMemory(content: string, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const tokens = contentTokenSet(content);
  let score = 0;
  for (const term of terms) {
    if (tokens.has(term)) score += 1;
  }
  return score;
}

export function searchMemoryItems(
  items: readonly MemoryItem[],
  query: string,
  k: number,
): MemoryItem[] {
  const terms = queryTokens(query);
  if (terms.length === 0 || k <= 0) return [];
  return items
    .map((item) => ({ item, score: scoreMemory(item.content, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, k)
    .map((entry) => entry.item);
}

export function legacySubstringSearch(
  items: readonly MemoryItem[],
  query: string,
  k: number,
): MemoryItem[] {
  const normalized = normalizeContent(query);
  if (normalized.length === 0 || k <= 0) return [];
  return items
    .filter((item) => normalizeContent(item.content).includes(normalized))
    .slice(0, k);
}
