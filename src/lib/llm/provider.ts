import 'server-only';

export interface LLMToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export type LLMStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: LLMToolCall };

export interface LLMStreamOptions {
  model: string;
  messages: LLMMessage[];
  systemPrompt: string;
  temperature: number;
  apiKey: string;
  oauthToken?: string;
  tools?: LLMToolDefinition[];
}

export interface LLMStreamResult {
  stream: AsyncIterable<LLMStreamEvent>;
  getUsage: () => { tokensIn: number; tokensOut: number };
}

export interface LLMProvider {
  createStream(options: LLMStreamOptions): Promise<LLMStreamResult>;
}
