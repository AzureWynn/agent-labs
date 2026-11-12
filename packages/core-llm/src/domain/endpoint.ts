/**
 * OpenAI 兼容客户端会在 baseURL 后面拼 `/chat/completions`。
 * 如果用户只给 `http://localhost:11434`，请求会打到 `/chat/completions`，
 * 而 Ollama 的兼容端点在 `/v1` 下，所以这里统一补 `/v1`。
 */
export function normalizeOpenAiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed === '') {
    throw new Error('baseURL 不能为空');
  }
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function resolveTimeoutMs(raw: string | undefined, fallback = 240_000): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`超时时间不合法: ${raw}`);
  }
  return value;
}
