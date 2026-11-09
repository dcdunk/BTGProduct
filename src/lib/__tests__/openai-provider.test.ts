import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { OpenAIProvider } from '@/lib/llm/openai';

// Real SDK against a local server, so an SDK upgrade that changes the wire
// format or the streaming shape fails here.
const chunk = (delta: object, usage?: object) =>
  `data: ${JSON.stringify({
    id: 'c1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'test-model',
    choices: usage ? [] : [{ index: 0, delta, finish_reason: null }],
    ...(usage ? { usage } : {}),
  })}\n\n`;

let server: Server;
let requestBody: Record<string, unknown>;
const previousBaseUrl = process.env.OPENAI_BASE_URL;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', d => (raw += d));
    req.on('end', () => {
      requestBody = JSON.parse(raw);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(chunk({ role: 'assistant', content: 'Hel' }));
      res.write(chunk({ content: 'lo' }));
      res.write(chunk({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":' } }] }));
      res.write(chunk({ tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] }));
      res.write(chunk({}, { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 }));
      res.end('data: [DONE]\n\n');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(() => {
  server.close();
  if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
  else process.env.OPENAI_BASE_URL = previousBaseUrl;
});

it('streams text and tool calls through the OpenAI SDK and reports usage', async () => {
  const result = await new OpenAIProvider().createStream({
    apiKey: 'test-key',
    model: 'test-model',
    temperature: 0.5,
    systemPrompt: 'be brief',
    messages: [{ role: 'user', content: 'hi' }],
    tools: [{ name: 'lookup', description: 'd', inputSchema: { type: 'object' } }],
  } as Parameters<OpenAIProvider['createStream']>[0]);

  const events = [];
  for await (const event of result.stream) events.push(event);

  expect(events).toEqual([
    { type: 'text', content: 'Hel' },
    { type: 'text', content: 'lo' },
    { type: 'tool_call', toolCall: { id: 'call_1', name: 'lookup', arguments: { q: 'x' } } },
  ]);
  expect(result.getUsage()).toEqual({ tokensIn: 11, tokensOut: 7 });
  expect(requestBody).toMatchObject({
    model: 'test-model',
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ],
  });
});
