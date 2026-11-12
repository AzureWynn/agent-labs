import type { AddMemoryResult, MemoryCandidate, MemoryItem } from './memory.js';
import {
  DEFAULT_NEAR_DUPLICATE_THRESHOLD,
  contentTokenSet,
  findDuplicate,
} from './dedup.js';
import { searchMemoryItems } from './retrieval.js';

function isSubset(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  for (const token of left) {
    if (!right.has(token)) return false;
  }
  return true;
}

function preferIncoming(existing: string, incoming: string): boolean {
  const existingTokens = contentTokenSet(existing);
  const incomingTokens = contentTokenSet(incoming);
  const existingSubset = isSubset(existingTokens, incomingTokens);
  const incomingSubset = isSubset(incomingTokens, existingTokens);
  if (incomingSubset) return false;
  if (existingSubset) return true;
  return (
    incomingTokens.size > existingTokens.size ||
    (incomingTokens.size === existingTokens.size && incoming.length > existing.length)
  );
}

export interface MemoryStoreOptions {
  readonly now: () => Date;
  readonly nextId: () => string;
  readonly nearDuplicateThreshold?: number;
}

export class MemoryStore {
  private readonly items: MemoryItem[] = [];
  private readonly now: () => Date;
  private readonly nextId: () => string;
  private readonly nearDuplicateThreshold: number;

  constructor(options: MemoryStoreOptions) {
    this.now = options.now;
    this.nextId = options.nextId;
    this.nearDuplicateThreshold =
      options.nearDuplicateThreshold ?? DEFAULT_NEAR_DUPLICATE_THRESHOLD;
  }

  add(candidate: MemoryCandidate): AddMemoryResult {
    const content = candidate.content.trim();
    if (content.length === 0) {
      throw new Error('记忆内容不能为空');
    }

    const match = findDuplicate(this.items, content, this.nearDuplicateThreshold);
    if (match) {
      const existing = match.item;
      if (preferIncoming(existing.content, content)) {
        existing.content = content;
      }
      existing.updatedAt = this.now().toISOString();
      if (candidate.tags && candidate.tags.length > 0) {
        existing.tags = Array.from(new Set([...existing.tags, ...candidate.tags]));
      }
      return {
        item: existing,
        outcome: match.kind === 'exact' ? 'exact' : 'near',
      };
    }

    const timestamp = this.now().toISOString();
    const item: MemoryItem = {
      id: this.nextId(),
      content,
      sessionId: candidate.sessionId,
      createdAt: timestamp,
      updatedAt: timestamp,
      tags: candidate.tags ? [...candidate.tags] : [],
    };
    this.items.push(item);
    return { item, outcome: 'added' };
  }

  search(query: string, k: number): MemoryItem[] {
    return searchMemoryItems(this.items, query, k);
  }

  all(): readonly MemoryItem[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }
}
