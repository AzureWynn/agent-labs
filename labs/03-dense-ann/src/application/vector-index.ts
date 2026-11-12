export interface VectorIndex {
  readonly name: string;
  build(vectors: readonly number[][]): Promise<void>;
  search(query: readonly number[], k: number): number[];
}

export function validateVectors(vectors: readonly number[][]): number {
  if (vectors.length === 0) {
    throw new Error('向量不能为空');
  }
  const dimension = vectors[0]?.length ?? 0;
  if (dimension === 0) {
    throw new Error('向量维度不能为 0');
  }
  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error(`向量维度不一致: ${vector.length} != ${dimension}`);
    }
  }
  return dimension;
}

export function assertVectorDimension(
  vector: readonly number[],
  dimension: number,
  label: string,
): void {
  if (vector.length !== dimension) {
    throw new Error(`${label} 维度不一致: ${vector.length} != ${dimension}`);
  }
}
