import 'server-only';
import { GoogleGenAI, type FunctionDeclaration } from '@google/genai';
import { OAuth2Client } from 'google-auth-library';
import { sanitizeForLog } from '@/lib/sanitize';
import { LLMError } from './errors';
import type { LLMProvider, LLMStreamOptions, LLMStreamResult, LLMStreamEvent, LLMToolCall } from './provider';

export class GoogleProvider implements LLMProvider {
  async createStream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      // Initialize client: prefer OAuth token, fall back to API key
      let ai: GoogleGenAI;
      if (options.oauthToken) {
        const oauth2Client = new OAuth2Client();
        oauth2Client.setCredentials({ access_token: options.oauthToken });
        ai = new GoogleGenAI({ googleAuthOptions: { authClient: oauth2Client } });
      } else {
        ai = new GoogleGenAI({ apiKey: options.apiKey });
      }

      // Build tool declarations
      const tools = options.tools?.map(t => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.inputSchema,
      } as FunctionDeclaration));

      // Convert messages to Gemini content format
      const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];
      for (const m of options.messages) {
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const parts: Array<Record<string, unknown>> = [];
          if (m.content) parts.push({ text: m.content });
          for (const tc of m.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
          }
          contents.push({ role: 'model', parts });
        } else if (m.role === 'tool_result') {
          contents.push({
            role: 'user',
            parts: [{
              functionResponse: {
                name: m.toolCallId || 'unknown',
                response: { result: m.content },
              },
            }],
          });
        } else {
          contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          });
        }
      }

      const response = await ai.models.generateContentStream({
        model: options.model,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          temperature: options.temperature,
          ...(tools && tools.length > 0
            ? { tools: [{ functionDeclarations: tools }] }
            : {}),
        },
      });

      const asyncIterable: AsyncIterable<LLMStreamEvent> = {
        async *[Symbol.asyncIterator]() {
          const pendingToolCalls: LLMToolCall[] = [];
          let callCounter = 0;

          for await (const chunk of response) {
            // Check for function calls
            if (chunk.functionCalls) {
              for (const fc of chunk.functionCalls) {
                callCounter++;
                pendingToolCalls.push({
                  id: `gemini-tc-${callCounter}`,
                  name: fc.name ?? '',
                  arguments: (fc.args || {}) as Record<string, unknown>,
                });
              }
            }

            // Yield text content
            if (chunk.text) {
              yield { type: 'text', content: chunk.text };
            }

            // Capture usage metadata
            if (chunk.usageMetadata) {
              tokensIn = chunk.usageMetadata.promptTokenCount ?? tokensIn;
              tokensOut = chunk.usageMetadata.candidatesTokenCount ?? tokensOut;
            }
          }

          // Yield tool calls after stream completes
          for (const tc of pendingToolCalls) {
            yield { type: 'tool_call', toolCall: tc };
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
        'google',
        (err as { status?: number }).status
      );
    }
  }
}
