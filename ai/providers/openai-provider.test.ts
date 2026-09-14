import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from './openai-provider.js';

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.AI_OPENAI_MODEL;

test.after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.AI_OPENAI_MODEL;
  else process.env.AI_OPENAI_MODEL = originalModel;
});

test('OpenAI provider sends stateless Responses API text requests', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.AI_OPENAI_MODEL = 'gpt-test';

  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'hello' }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const provider = new OpenAIProvider();
  const text = await provider.generateText('hi', { task: 'chat' });

  assert.equal(text, 'hello');
  assert.equal(capturedUrl, 'https://api.openai.com/v1/responses');
  assert.equal(
    new Headers(capturedInit?.headers).get('Authorization'),
    'Bearer test-key',
  );

  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.model, 'gpt-test');
  assert.equal(body.store, false);
  assert.equal(body.input, 'hi');
});

test('OpenAI provider sends receipt image as a data URL and requests JSON mode', async () => {
  process.env.OPENAI_API_KEY = 'test-key';

  let capturedBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: '{"items":[]}' }],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const provider = new OpenAIProvider();
  const parsed = await provider.generateJsonFromImage<{ items: unknown[] }>(
    'read receipt',
    { mimeType: 'image/jpeg', data: 'YWJj' },
    { task: 'scan-receipt', model: 'gpt-5.6-luna' },
  );

  assert.deepEqual(parsed, { items: [] });
  const requestBody = capturedBody as Record<string, unknown> | null;
  assert.ok(requestBody);
  assert.equal(requestBody.store, false);
  assert.deepEqual(requestBody.text, { format: { type: 'json_object' } });

  const input = requestBody.input as Array<{
    content: Array<{ type: string; image_url?: string }>;
  }>;
  const image = input[0].content.find((part) => part.type === 'input_image');
  assert.equal(image?.image_url, 'data:image/jpeg;base64,YWJj');
});
