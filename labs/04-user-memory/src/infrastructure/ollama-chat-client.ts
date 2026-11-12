export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ToolDefinition {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  readonly name: string;
  readonly arguments: unknown;
}

export interface ChatResult {
  readonly content: string;
  readonly toolCalls: readonly ToolCall[];
}

export interface OllamaChatOptions {
  readonly host: string;
  readonly model: string;
  readonly timeoutMs?: number;
}

interface OllamaChatResponse {
  readonly message?: {
    readonly content?: string;
    readonly tool_calls?: readonly {
      readonly function?: {
        readonly name?: string;
        readonly arguments?: unknown;
      };
    }[];
  };
  readonly error?: string;
}

export class OllamaChatClient {
  private readonly host: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: OllamaChatOptions) {
    this.host = options.host.replace(/\/$/, '');
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async chat(messages: readonly ChatMessage[], tools: readonly ToolDefinition[]): Promise<ChatResult> {
    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama 返回 ${response.status}：${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    if (data.error) throw new Error(`Ollama 错误：${data.error}`);

    const toolCalls = (data.message?.tool_calls ?? []).flatMap((call) => {
      const name = call.function?.name;
      if (!name) return [];
      return [{ name, arguments: call.function?.arguments }];
    });

    return {
      content: data.message?.content ?? '',
      toolCalls,
    };
  }
}
