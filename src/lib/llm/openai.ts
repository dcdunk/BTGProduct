import 'server-only';
import OpenAI from 'openai';
import { sanitizeForLog } from '@/lib/sanitize';
import { LLMError } from './errors';
import type { LLMProvider, LLMStreamOptions, LLMStreamResult, LLMStreamEvent } from './provider';

export class OpenAIProvider implements LLMProvider {
  async createStream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const client = new OpenAI({ apiKey: options.apiKey });

    let tokensIn = 0;
    let tokensOut = 0;

    try {
      // Build messages, handling tool_result messages
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: options.systemPrompt },
      ];

      for (const m of options.messages) {
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });
        } else if (m.role === 'tool_result') {
          messages.push({
            role: 'tool',
            tool_call_id: m.toolCallId!,
            content: m.content,
          });
        } else {
          messages.push({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          });
        }
      }

      // Build tools if provided
      const tools = options.tools?.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      const stream = await client.chat.completions.create({
        model: options.model,
        temperature: options.temperature,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const asyncIterable: AsyncIterable<LLMStreamEvent> = {
        async *[Symbol.asyncIterator]() {
          // Accumulate tool calls from streaming deltas
          const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {};

          for await (const chunk of stream) {
            if (chunk.usage) {
              tokensIn = chunk.usage.prompt_tokens;
              tokensOut = chunk.usage.completion_tokens;
            }

            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Text content
            if (delta.content) {
              yield { type: 'text', content: delta.content };
            }

            // Tool calls (accumulated incrementally)
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!(idx in toolCallsMap)) {
                  toolCallsMap[idx] = {
                    id: tc.id || '',
                    name: tc.function?.name || '',
                    arguments: '',
                  };
                }
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                if (tc.function?.arguments) {
                  toolCallsMap[idx].arguments += tc.function.arguments;
                }
              }
            }
          }

          // Yield accumulated tool calls
          for (const tc of Object.values(toolCallsMap)) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(tc.arguments); } catch { /* empty */ }
            yield {
              type: 'tool_call',
              toolCall: { id: tc.id, name: tc.name, arguments: args },
            };
          }
        },
      };

      return {
        stream: asyncIterable,
        getUsage: () => ({ tokensIn, tokensOut }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new LLMError(
        sanitizeForLog(message),
        'openai',
        (err as { status?: number }).status
      );
    }
  }
}
