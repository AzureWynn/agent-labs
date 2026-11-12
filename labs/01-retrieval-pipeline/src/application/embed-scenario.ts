import type { EmbeddingClient } from '@agentlab/core-llm';
import type { Scenario } from '@agentlab/core-scenario';

export interface ScenarioVectors {
  readonly docVectors: readonly (readonly number[])[];
  readonly queryVectors: ReadonlyMap<string, readonly number[]>;
}

export async function embedScenario(
  scenario: Scenario,
  client: EmbeddingClient,
): Promise<ScenarioVectors> {
  const queries = Object.keys(scenario.labels);
  const docVectors = await client.embed(scenario.docs.map((doc) => doc.text));
  const queryVectors = await client.embed(queries);

  if (docVectors.length !== scenario.docs.length) {
    throw new Error(
      `文档向量数量不一致: 期望 ${scenario.docs.length}，实际 ${docVectors.length}`,
    );
  }
  if (queryVectors.length !== queries.length) {
    throw new Error(
      `查询向量数量不一致: 期望 ${queries.length}，实际 ${queryVectors.length}`,
    );
  }

  return {
    docVectors,
    queryVectors: new Map(
      queries.map((query, index) => [query, queryVectors[index] ?? []]),
    ),
  };
}
