import { describe, it, expect, vi } from 'vitest';

vi.mock('../llm/anthropic', () => ({ AnthropicProvider: class AnthropicProvider {} }));
vi.mock('../llm/openai', () => ({ OpenAIProvider: class OpenAIProvider {} }));
vi.mock('../llm/google', () => ({ GoogleProvider: class GoogleProvider {} }));

import { getLLMProvider } from '../llm/index';

describe('getLLMProvider', () => {
  it('returns an AnthropicProvider instance for "anthropic"', () => {
    const provider = getLLMProvider('anthropic');
    expect(provider.constructor.name).toBe('AnthropicProvider');
  });

  it('returns an OpenAIProvider instance for "openai"', () => {
    const provider = getLLMProvider('openai');
    expect(provider.constructor.name).toBe('OpenAIProvider');
  });

  it('returns a GoogleProvider instance for "google"', () => {
    const provider = getLLMProvider('google');
    expect(provider.constructor.name).toBe('GoogleProvider');
  });

  it('throws an error for an unknown provider', () => {
    expect(() => getLLMProvider('bedrock' as never)).toThrow();
  });

  it('error message includes the provider name', () => {
    expect(() => getLLMProvider('bedrock' as never)).toThrow('bedrock');
  });
});
