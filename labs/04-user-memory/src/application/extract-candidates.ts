import type { MemoryScenario, MemoryScenarioRound, MemoryScenarioUser } from '../domain/memory-scenario.js';
import type { ChatMessage, OllamaChatClient, ToolDefinition } from '../infrastructure/ollama-chat-client.js';

export interface ExtractedCandidate {
  readonly content: string;
  readonly tags: readonly string[];
  readonly round?: number;
}

export interface ExtractedRound {
  readonly userId: string;
  readonly round: number;
  readonly candidates: readonly ExtractedCandidate[];
}

export interface ExtractionFixture {
  readonly scenario: string;
  readonly model: string;
  readonly generatedAt: string;
  readonly source: 'ollama';
  readonly rounds: readonly ExtractedRound[];
}

const ADD_MEMORY_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'add_memory',
    description: '把用户对话中值得长期记住的一条事实写入记忆。',
    parameters: {
      type: 'object',
      properties: {
        round: {
          type: 'integer',
          description: '这条事实来自第几轮对话，必须填写输入中的轮次编号。',
        },
        content: {
          type: 'string',
          description: '一条简洁的中文事实，保留宠物名、日期、数字和否定词。',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '可选标签，如 主人/宠物/健康/日程/联系/地址/照护。',
        },
      },
      required: ['round', 'content'],
    },
  },
};

const SYSTEM_PROMPT = [
  '你是社区宠物医院的复诊助手。只提取用户明确说出的、未来复诊会用到的长期事实。',
  '',
  '规则：',
  '1. 每条事实单独调用一次 add_memory，不要合并多件事。',
  '2. 在 round 参数填写这条事实来自第几轮对话。',
  '3. 保留宠物名、日期、数字、否定词，不要改写数字。',
  '4. 不要推测用户没说的信息。',
  '5. 如果某轮没有长期事实，跳过该轮。',
  '6. 只使用 add_memory，不要输出解释。',
].join('\n');

function parseTags(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function parseArguments(raw: unknown): ExtractedCandidate | undefined {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      const content = raw.trim();
      return content.length > 0 ? { content, tags: [] } : undefined;
    }
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.content !== 'string') return undefined;
  const content = record.content.trim();
  if (content.length === 0) return undefined;
  const round =
    typeof record.round === 'number' && Number.isInteger(record.round)
      ? record.round
      : undefined;
  return round === undefined
    ? { content, tags: parseTags(record.tags) }
    : { content, tags: parseTags(record.tags), round };
}

export function candidatesFromToolCalls(
  toolCalls: readonly { readonly name: string; readonly arguments: unknown }[],
): readonly ExtractedCandidate[] {
  return toolCalls.flatMap((call) => {
    if (call.name !== 'add_memory') return [];
    const candidate = parseArguments(call.arguments);
    return candidate ? [candidate] : [];
  });
}

function messagesFor(batch: readonly MemoryScenarioRound[]): readonly ChatMessage[] {
  const lines = batch.map((round) => `第${round.round}轮 用户说：${round.user}`).join('\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `下面是同一用户连续几轮对话。请逐轮提取长期事实。\n\n${lines}`,
    },
  ];
}

function resolveRound(
  raw: number | undefined,
  batch: readonly MemoryScenarioRound[],
): number | undefined {
  if (batch.length === 0) return undefined;
  const first = batch[0];
  if (!first) return undefined;
  if (raw !== undefined) {
    if (batch.some((round) => round.round === raw)) return raw;
    if (Number.isInteger(raw) && raw >= 1 && raw <= batch.length) {
      return batch[raw - 1]?.round;
    }
  }
  return first.round;
}

function toExtractedRounds(
  user: MemoryScenarioUser,
  batch: readonly MemoryScenarioRound[],
  candidates: readonly ExtractedCandidate[],
): readonly ExtractedRound[] {
  const byRound = new Map<number, ExtractedCandidate[]>();

  for (const candidate of candidates) {
    const round = resolveRound(candidate.round, batch);
    if (round === undefined) continue;
    const list = byRound.get(round) ?? [];
    list.push({ content: candidate.content, tags: candidate.tags });
    byRound.set(round, list);
  }

  return batch.map((round) => ({
    userId: user.id,
    round: round.round,
    candidates: byRound.get(round.round) ?? [],
  }));
}

async function extractBatch(
  client: OllamaChatClient,
  user: MemoryScenarioUser,
  batch: readonly MemoryScenarioRound[],
): Promise<readonly ExtractedRound[]> {
  const result = await client.chat(messagesFor(batch), [ADD_MEMORY_TOOL]);
  return toExtractedRounds(user, batch, candidatesFromToolCalls(result.toolCalls));
}

async function extractBatchWithRetry(
  client: OllamaChatClient,
  user: MemoryScenarioUser,
  batch: readonly MemoryScenarioRound[],
  attempts = 3,
): Promise<readonly ExtractedRound[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await extractBatch(client, user, batch);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function extractScenario(
  scenario: MemoryScenario,
  client: OllamaChatClient,
  options: {
    readonly model: string;
    readonly concurrency?: number;
    readonly batchSize?: number;
    readonly log?: (message: string) => void;
  },
): Promise<ExtractionFixture> {
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const batchSize = Math.max(1, options.batchSize ?? 5);
  const log = options.log ?? (() => {});
  const tasks = scenario.users.flatMap((user) =>
    chunk(user.rounds, batchSize).map((batch) => ({ user, batch })),
  );
  const results: (readonly ExtractedRound[])[] = new Array(tasks.length);
  let next = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      const task = tasks[index];
      if (!task) return;
      results[index] = await extractBatchWithRetry(client, task.user, task.batch);
      completed += 1;
      if (completed % 5 === 0 || completed === tasks.length) {
        log(`抽取进度 ${completed}/${tasks.length} 批`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );

  return {
    scenario: scenario.name,
    model: options.model,
    generatedAt: new Date().toISOString(),
    source: 'ollama',
    rounds: results.flat(),
  };
}
