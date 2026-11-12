import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaEmbeddingClient } from './ollama-embedding-client.js';

test('shouldPostInputsAndReturnEmbeddings', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ embeddings: [[1, 2], [3, 4]] }), { status: 200 });
  }) as typeof fetch;

  const client = new OllamaEmbeddingClient({
    host: 'http://localhost:11434/',
    model: 'nomic-embed-text',
    fetchImpl: fakeFetch,
  });

  const vectors = await client.embed(['alpha', 'beta']);
  assert.deepEqual(vectors, [[1, 2], [3, 4]]);
  assert.equal(calls[0]?.url, 'http://localhost:11434/api/embed');
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    model: 'nomic-embed-text',
    input: ['alpha', 'beta'],
  });
});

test('shouldReturnEmptyWithoutCallingFetch', async () => {
  const client = new OllamaEmbeddingClient({
    host: 'http://localhost:11434',
    model: 'm',
    fetchImpl: (() => {
      throw new Error('should not call fetch');
    }) as typeof fetch,
  });
  assert.deepEqual(await client.embed([]), []);
});

test('shouldRejectWhenEmbeddingCountDiffersFromInput', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ embeddings: [[1]] }), { status: 200 })) as typeof fetch;
  const client = new OllamaEmbeddingClient({ host: 'http://x', model: 'm', fetchImpl: fakeFetch });
  await assert.rejects(() => client.embed(['a', 'b']), /不一致/);
});

test('shouldRejectNonOkResponse', async () => {
  const fakeFetch = (async () =>
    new Response('nope', { status: 500, statusText: 'Internal' })) as typeof fetch;
  const client = new OllamaEmbeddingClient({ host: 'http://x', model: 'm', fetchImpl: fakeFetch });
  await assert.rejects(() => client.embed(['a']), /500/);
});
