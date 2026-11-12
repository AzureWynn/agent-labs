export interface ScenarioDocument {
  readonly id: string;
  readonly text: string;
}

export interface Scenario {
  readonly name: string;
  readonly note?: string;
  readonly docs: readonly ScenarioDocument[];
  readonly labels: Readonly<Record<string, readonly string[]>>;
}

export class ScenarioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ScenarioValidationError(`${path} 必须是非空字符串`);
  }
  return value;
}

/**
 * 场景是数据，不是代码。这里把"什么算合法场景"集中成不变量：
 * - 文档非空且 id 唯一
 * - 每个查询至少有一个真值
 * - 真值必须指向存在的文档，且不能重复
 */
export function parseScenario(input: unknown, source = 'scenario'): Scenario {
  if (!isRecord(input)) {
    throw new ScenarioValidationError(`${source} 必须是一个对象`);
  }

  const name = requireNonEmptyString(input.name, 'name');
  const rawDocs = input.docs;
  if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
    throw new ScenarioValidationError('docs 必须是非空数组');
  }

  const docs: ScenarioDocument[] = rawDocs.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new ScenarioValidationError(`docs[${index}] 必须是对象`);
    }
    return {
      id: requireNonEmptyString(raw.id, `docs[${index}].id`),
      text: requireNonEmptyString(raw.text, `docs[${index}].text`),
    };
  });

  const docIds = new Set<string>();
  for (const doc of docs) {
    if (docIds.has(doc.id)) {
      throw new ScenarioValidationError(`文档 id 重复: ${doc.id}`);
    }
    docIds.add(doc.id);
  }

  const rawLabels = input.labels;
  if (!isRecord(rawLabels)) {
    throw new ScenarioValidationError('labels 必须是一个对象');
  }

  const labels: Record<string, string[]> = {};
  for (const [query, rawIds] of Object.entries(rawLabels)) {
    if (query.trim() === '') {
      throw new ScenarioValidationError('labels 的查询不能为空');
    }
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new ScenarioValidationError(`labels["${query}"] 必须是非空数组`);
    }
    const ids = rawIds.map((raw, index) =>
      requireNonEmptyString(raw, `labels["${query}"][${index}]`),
    );
    if (new Set(ids).size !== ids.length) {
      throw new ScenarioValidationError(`labels["${query}"] 存在重复真值`);
    }
    for (const id of ids) {
      if (!docIds.has(id)) {
        throw new ScenarioValidationError(`labels["${query}"] 指向不存在的文档: ${id}`);
      }
    }
    labels[query] = ids;
  }

  if (Object.keys(labels).length === 0) {
    throw new ScenarioValidationError('labels 不能为空');
  }

  const note = typeof input.note === 'string' ? input.note : undefined;
  return { name, note, docs, labels };
}
