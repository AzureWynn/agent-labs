export interface SyntheticVectorOptions {
  readonly count: number;
  readonly dimension: number;
  readonly clusters: number;
  readonly noise: number;
  readonly seed: number;
  readonly queryCount: number;
}

export interface SyntheticVectorDataset {
  readonly vectors: number[][];
  readonly queries: number[][];
}

export const DEFAULT_SYNTHETIC_OPTIONS: SyntheticVectorOptions = {
  count: 5000,
  dimension: 128,
  clusters: 50,
  noise: 0.15,
  seed: 42,
  queryCount: 30,
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
}

function createVector(center: readonly number[], noise: number, random: () => number): number[] {
  return center.map((value) => value + (random() * 2 - 1) * noise);
}

export function createSyntheticVectors(
  options: SyntheticVectorOptions,
): SyntheticVectorDataset {
  assertPositiveInteger(options.count, 'count');
  assertPositiveInteger(options.dimension, 'dimension');
  assertPositiveInteger(options.clusters, 'clusters');
  assertPositiveInteger(options.queryCount, 'queryCount');
  if (!Number.isFinite(options.noise) || options.noise < 0) {
    throw new Error('noise 必须是非负数');
  }

  const random = mulberry32(options.seed);
  const centers = Array.from({ length: options.clusters }, () =>
    Array.from({ length: options.dimension }, () => random() * 2 - 1),
  );

  const vectors = Array.from({ length: options.count }, (_, index) => {
    const center = centers[index % options.clusters] ?? [];
    return createVector(center, options.noise, random);
  });

  const queries = Array.from({ length: options.queryCount }, (_, index) => {
    const center = centers[index % options.clusters] ?? [];
    return createVector(center, options.noise, random);
  });

  return { vectors, queries };
}
