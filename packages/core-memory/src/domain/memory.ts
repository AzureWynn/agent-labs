export interface MemoryItem {
  readonly id: string;
  content: string;
  readonly sessionId: string;
  readonly createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface MemoryCandidate {
  readonly content: string;
  readonly sessionId: string;
  readonly tags?: readonly string[];
}

export type AddMemoryOutcome = 'added' | 'exact' | 'near';

export interface AddMemoryResult {
  readonly item: MemoryItem;
  readonly outcome: AddMemoryOutcome;
}
