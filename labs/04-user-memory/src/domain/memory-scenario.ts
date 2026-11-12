export interface MemoryScenarioFact {
  readonly id: string;
  readonly content: string;
  readonly tags: readonly string[];
}

export interface MemoryScenarioQuery {
  readonly query: string;
  readonly expectedFactIds: readonly string[];
}

export interface MemoryScenarioRound {
  readonly round: number;
  readonly user: string;
  readonly assistant: string;
}

export interface MemoryScenarioUser {
  readonly id: string;
  readonly owner: string;
  readonly pet: {
    readonly name: string;
    readonly species: string;
    readonly age: number;
  };
  readonly facts: readonly MemoryScenarioFact[];
  readonly rounds: readonly MemoryScenarioRound[];
  readonly queries: readonly MemoryScenarioQuery[];
}

export interface MemoryScenario {
  readonly name: string;
  readonly note: string;
  readonly users: readonly MemoryScenarioUser[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${path}.${key} 必须是非空字符串`);
  }
  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path}.${key} 必须是数字`);
  }
  return value;
}

function requireArray(record: Record<string, unknown>, key: string, path: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`${path}.${key} 必须是数组`);
  }
  return value;
}

function parseStringArray(value: unknown, path: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${path} 必须是字符串数组`);
  return value.map((item, index) => {
    if (typeof item !== 'string') throw new Error(`${path}[${index}] 必须是字符串`);
    return item;
  });
}

function parseFact(value: unknown, path: string): MemoryScenarioFact {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  return {
    id: requireString(value, 'id', path),
    content: requireString(value, 'content', path),
    tags: parseStringArray(value.tags, `${path}.tags`),
  };
}

function parseQuery(value: unknown, path: string): MemoryScenarioQuery {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  const expected = parseStringArray(value.expectedFactIds, `${path}.expectedFactIds`);
  if (expected.length === 0) throw new Error(`${path}.expectedFactIds 不能为空`);
  return {
    query: requireString(value, 'query', path),
    expectedFactIds: expected,
  };
}

function parseRound(value: unknown, path: string): MemoryScenarioRound {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  return {
    round: requireNumber(value, 'round', path),
    user: requireString(value, 'user', path),
    assistant: requireString(value, 'assistant', path),
  };
}

function parsePet(value: unknown, path: string): MemoryScenarioUser['pet'] {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  return {
    name: requireString(value, 'name', path),
    species: requireString(value, 'species', path),
    age: requireNumber(value, 'age', path),
  };
}

function parseUser(value: unknown, path: string): MemoryScenarioUser {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  return {
    id: requireString(value, 'id', path),
    owner: requireString(value, 'owner', path),
    pet: parsePet(value.pet, `${path}.pet`),
    facts: requireArray(value, 'facts', path).map((fact, index) =>
      parseFact(fact, `${path}.facts[${index}]`),
    ),
    rounds: requireArray(value, 'rounds', path).map((round, index) =>
      parseRound(round, `${path}.rounds[${index}]`),
    ),
    queries: requireArray(value, 'queries', path).map((query, index) =>
      parseQuery(query, `${path}.queries[${index}]`),
    ),
  };
}

export function parseMemoryScenario(input: unknown): MemoryScenario {
  if (!isRecord(input)) throw new Error('场景必须是对象');
  return {
    name: requireString(input, 'name', 'scenario'),
    note: typeof input.note === 'string' ? input.note : '',
    users: requireArray(input, 'users', 'scenario').map((user, index) =>
      parseUser(user, `scenario.users[${index}]`),
    ),
  };
}
