import 'server-only';
import type { LLMProvider } from './provider';
import type { Provider } from '@/types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GoogleProvider } from './google';

export function getLLMProvider(provider: Provider): LLMProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'google':
      return new GoogleProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export type { LLMProvider, LLMMessage, LLMStreamOptions, LLMStreamResult } from './provider';
export { LLMError } from './errors';
