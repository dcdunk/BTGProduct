import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ToolUseBlock, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { sanitizeForLog } from '@/lib/sanitize';
import { LLMError } from './errors';
import type { LLMProvider, LLMStreamOptions, LLMStreamResult, LLMStreamEvent } from './provider';

export class AnthropicProvider implements LLMProvider {
  async createStream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const client = new Anthropic({ apiKey: options.apiKey });

    let tokensIn = 0;
    let tokensOut = 0;

    try {
      // Build messages, handling tool_result messages
      const messages: MessageParam[] = [];
      for (const m of options.messages) {
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          // Assistant message that made tool calls
          const content: ContentBlockParam[] = [];
          if (m.content) {
            content.push({ type: 'text', text: m.content });
          }
          for (const tc of m.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
          messages.push({ role: 'assistant', content });
        } else if (m.role === 'tool_result') {
          // Tool result — Anthropic requires this as a user message with tool_result content
          messages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: m.toolCallId!,
              content: m.content,
            }],
          });
        } else {
          messages.push({ role: m.role as 'user' | 'assistant', content: m.content });
        }
      }

      // Build tools if provided
      const tools = options.tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
      }));

      const stream = client.messages.stream({
        model: options.model,
        max_tokens: 4096,
        temperature: options.temperature,
        system: options.systemPrompt,
        messages,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const asyncIterable: AsyncIterable<LLMStreamEvent> = {
        async *[Symbol.asyncIterator]() {
          const toolUseBlocks: ToolUseBlock[] = [];

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              yield { type: 'text', content: event.delta.text };
            }
            // Capture complete tool_use blocks at block stop
            if (event.type === 'content_block_stop') {
              const finalMsg = stream.currentMessage;
              if (finalMsg) {
                const block = finalMsg.content[event.index];
                if (block && block.type === 'tool_use' && !toolUseBlocks.some(b => b.id === block.id)) {
                  toolUseBlocks.push(block);
                }
              }
            }
          }

          // After stream completes, yield any tool calls
          for (const block of toolUseBlocks) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: block.id,
                name: block.name,
                arguments: block.input as Record<string, unknown>,
              },
            };
          }

          const finalMessage = await stream.finalMessage();
          tokensIn = finalMessage.usage.input_tokens;
          tokensOut = finalMessage.usage.output_tokens;
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
        'anthropic',
        (err as { status?: number }).status
      );
    }
  }
}
