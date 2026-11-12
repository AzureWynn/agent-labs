import {
  MemoryStore,
  contentTokenSet,
  duplicateRate,
  ingestCandidates,
  overlapCoefficient,
} from '@agentlab/core-memory';
import type { IngestStats, MemoryCandidate } from '@agentlab/core-memory';
import type { MemoryScenario, MemoryScenarioUser } from '../domain/memory-scenario.js';
import type { ExtractedRound, ExtractionFixture } from './extract-candidates.js';

export interface QueryOutcome {
  readonly query: string;
  readonly expectedFactIds: readonly string[];
  readonly rank: number;
  readonly canonicalRank: number;
  readonly top: readonly string[];
}

export interface UserMemoryReport {
  readonly userId: string;
  readonly rounds: number;
  readonly rawCandidates: number;
  readonly invalidCandidates: number;
  readonly validCandidates: number;
  readonly added: number;
  readonly mergedExact: number;
  readonly mergedNear: number;
  readonly unique: number;
  readonly duplicateRate: number;
  readonly canonicalFacts: number;
  readonly recallAt1: number;
  readonly recallAt3: number;
  readonly canonicalRecallAt1: number;
  readonly canonicalRecallAt3: number;
  readonly queries: readonly QueryOutcome[];
}

export interface MemoryBenchmarkReport {
  readonly scenario: string;
  readonly model: string;
  readonly users: readonly UserMemoryReport[];
  readonly totals: {
    readonly rounds: number;
    readonly rawCandidates: number;
    readonly invalidCandidates: number;
    readonly validCandidates: number;
    readonly added: number;
    readonly mergedExact: number;
    readonly mergedNear: number;
    readonly unique: number;
    readonly duplicateRate: number;
    readonly canonicalFacts: number;
    readonly recallAt1: number;
    readonly recallAt3: number;
    readonly canonicalRecallAt1: number;
    readonly canonicalRecallAt3: number;
  };
}

function createStore(): MemoryStore {
  let counter = 0;
  return new MemoryStore({
    now: () => new Date('2026-10-21T00:00:00.000Z'),
    nextId: () => `m${(counter += 1)}`,
  });
}

function roundsFor(userId: string, rounds: readonly ExtractedRound[]): readonly ExtractedRound[] {
  return rounds
    .filter((round) => round.userId === userId)
    .slice()
    .sort((left, right) => left.round - right.round);
}

function isAbout(content: string, factContent: string): boolean {
  const itemTokens = contentTokenSet(content);
  const factTokens = contentTokenSet(factContent);
  if (itemTokens.size === 0 || factTokens.size === 0) return false;
  return overlapCoefficient(itemTokens, factTokens) >= 0.5;
}

function recallAt1(ranks: readonly number[]): number {
  if (ranks.length === 0) return 0;
  return ranks.filter((rank) => rank === 0).length / ranks.length;
}

function recallAt3(ranks: readonly number[]): number {
  if (ranks.length === 0) return 0;
  return ranks.filter((rank) => rank >= 0 && rank < 3).length / ranks.length;
}

function evaluateCanonicalQueries(user: MemoryScenarioUser): {
  readonly ranks: readonly number[];
  readonly tops: readonly (readonly string[])[];
} {
  const store = createStore();
  const factToItem = new Map<string, string>();

  for (const fact of user.facts) {
    const result = store.add({
      content: fact.content,
      sessionId: user.id,
      tags: fact.tags,
    });
    factToItem.set(fact.id, result.item.id);
  }

  const ranks: number[] = [];
  const tops: string[][] = [];
  for (const query of user.queries) {
    const results = store.search(query.query, 3);
    ranks.push(
      results.findIndex((item) =>
        query.expectedFactIds.some((factId) => factToItem.get(factId) === item.id),
      ),
    );
    tops.push(results.map((item) => item.content));
  }
  return { ranks, tops };
}

function evaluateExtractedQueries(
  user: MemoryScenarioUser,
  store: MemoryStore,
): {
  readonly ranks: readonly number[];
  readonly tops: readonly (readonly string[])[];
} {
  const factById = new Map(user.facts.map((fact) => [fact.id, fact.content]));
  const ranks: number[] = [];
  const tops: string[][] = [];

  for (const query of user.queries) {
    const results = store.search(query.query, 3);
    ranks.push(
      results.findIndex((item) =>
        query.expectedFactIds.some((factId) => {
          const factContent = factById.get(factId);
          return factContent !== undefined && isAbout(item.content, factContent);
        }),
      ),
    );
    tops.push(results.map((item) => item.content));
  }
  return { ranks, tops };
}

function evaluateUser(
  user: MemoryScenarioUser,
  rounds: readonly ExtractedRound[],
): UserMemoryReport {
  const ordered = roundsFor(user.id, rounds);
  const candidates = ordered.flatMap((round) => round.candidates);
  const invalid = candidates.filter((candidate) => candidate.content.trim().length === 0);
  const valid: MemoryCandidate[] = candidates
    .filter((candidate) => candidate.content.trim().length > 0)
    .map((candidate) => ({
      content: candidate.content,
      tags: candidate.tags,
      sessionId: user.id,
    }));

  const store = createStore();
  const stats: IngestStats = ingestCandidates(store, valid);
  const canonical = evaluateCanonicalQueries(user);
  const extracted = evaluateExtractedQueries(user, store);
  const outcomes: QueryOutcome[] = user.queries.map((query, index) => ({
    query: query.query,
    expectedFactIds: query.expectedFactIds,
    rank: extracted.ranks[index] ?? -1,
    canonicalRank: canonical.ranks[index] ?? -1,
    top: extracted.tops[index] ?? [],
  }));

  return {
    userId: user.id,
    rounds: ordered.length,
    rawCandidates: candidates.length,
    invalidCandidates: invalid.length,
    validCandidates: valid.length,
    added: stats.added,
    mergedExact: stats.mergedExact,
    mergedNear: stats.mergedNear,
    unique: stats.unique,
    duplicateRate: duplicateRate(stats),
    canonicalFacts: user.facts.length,
    recallAt1: recallAt1(extracted.ranks),
    recallAt3: recallAt3(extracted.ranks),
    canonicalRecallAt1: recallAt1(canonical.ranks),
    canonicalRecallAt3: recallAt3(canonical.ranks),
    queries: outcomes,
  };
}

export function evaluateMemoryBenchmark(
  scenario: MemoryScenario,
  fixture: ExtractionFixture,
): MemoryBenchmarkReport {
  const users = scenario.users.map((user) => evaluateUser(user, fixture.rounds));
  const sum = (pick: (user: UserMemoryReport) => number): number =>
    users.reduce((total, user) => total + pick(user), 0);

  const validCandidates = sum((user) => user.validCandidates);
  const merged = sum((user) => user.mergedExact + user.mergedNear);
  const queryCount = users.reduce((total, user) => total + user.queries.length, 0);
  const hit1 = users.reduce(
    (total, user) => total + user.queries.filter((query) => query.rank === 0).length,
    0,
  );
  const hit3 = users.reduce(
    (total, user) =>
      total + user.queries.filter((query) => query.rank >= 0 && query.rank < 3).length,
    0,
  );
  const canonicalHit1 = users.reduce(
    (total, user) =>
      total + user.queries.filter((query) => query.canonicalRank === 0).length,
    0,
  );
  const canonicalHit3 = users.reduce(
    (total, user) =>
      total +
      user.queries.filter((query) => query.canonicalRank >= 0 && query.canonicalRank < 3)
        .length,
    0,
  );

  return {
    scenario: scenario.name,
    model: fixture.model,
    users,
    totals: {
      rounds: sum((user) => user.rounds),
      rawCandidates: sum((user) => user.rawCandidates),
      invalidCandidates: sum((user) => user.invalidCandidates),
      validCandidates,
      added: sum((user) => user.added),
      mergedExact: sum((user) => user.mergedExact),
      mergedNear: sum((user) => user.mergedNear),
      unique: sum((user) => user.unique),
      duplicateRate: validCandidates === 0 ? 0 : merged / validCandidates,
      canonicalFacts: sum((user) => user.canonicalFacts),
      recallAt1: queryCount === 0 ? 0 : hit1 / queryCount,
      recallAt3: queryCount === 0 ? 0 : hit3 / queryCount,
      canonicalRecallAt1: queryCount === 0 ? 0 : canonicalHit1 / queryCount,
      canonicalRecallAt3: queryCount === 0 ? 0 : canonicalHit3 / queryCount,
    },
  };
}
