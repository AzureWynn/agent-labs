export type {
  AddMemoryOutcome,
  AddMemoryResult,
  MemoryCandidate,
  MemoryItem,
} from './domain/memory.js';
export {
  DEFAULT_NEAR_DUPLICATE_THRESHOLD,
  MIN_CONTENT_TOKENS,
  contentTokenSet,
  contentTokens,
  findDuplicate,
  hasNegation,
  normalizeContent,
  numericTokens,
  overlapCoefficient,
  queryTokens,
} from './domain/dedup.js';
export type { DuplicateMatch } from './domain/dedup.js';
export {
  legacySubstringSearch,
  scoreMemory,
  searchMemoryItems,
} from './domain/retrieval.js';
export { MemoryStore } from './domain/memory-store.js';
export type { MemoryStoreOptions } from './domain/memory-store.js';
export { duplicateRate, ingestCandidates } from './application/ingest.js';
export type { IngestStats } from './application/ingest.js';
