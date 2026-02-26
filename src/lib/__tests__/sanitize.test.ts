import { describe, it, expect } from 'vitest';
import { sanitizeForLog } from '../sanitize';

describe('sanitizeForLog', () => {
  it('redacts Anthropic API keys', () => {
    const input = 'Error with key sk-ant-api03-abc123DEF456xyz789';
    expect(sanitizeForLog(input)).toBe('Error with key [REDACTED_API_KEY]');
  });

  it('redacts OpenAI project keys', () => {
    const input = 'Key: sk-proj-abc123DEF456xyz789longkey';
    expect(sanitizeForLog(input)).toBe('Key: [REDACTED_API_KEY]');
  });

  it('redacts OpenAI legacy keys (sk- with 20+ chars)', () => {
    const input = 'Using sk-abcdefghijklmnopqrstuvwxyz';
    expect(sanitizeForLog(input)).toBe('Using [REDACTED_API_KEY]');
  });

  it('redacts Google AI keys', () => {
    const input = 'Google key: AIzaSyB1234567890abcdefghijklmnopqrst';
    expect(sanitizeForLog(input)).toBe('Google key: [REDACTED_API_KEY]');
  });

  it('redacts multiple keys in one string', () => {
    const input = 'Keys: sk-ant-api03-key1 and AIzaSyB1234567890abcdefghijklmnopqrst';
    const result = sanitizeForLog(input);
    expect(result).toBe('Keys: [REDACTED_API_KEY] and [REDACTED_API_KEY]');
  });

  it('passes through text without keys unchanged', () => {
    const input = 'No keys here, just normal text.';
    expect(sanitizeForLog(input)).toBe(input);
  });

  it('does not redact short strings that match prefix but not length', () => {
    // "sk-short" is only 8 chars, below the 20+ threshold
    const input = 'sk-short should stay';
    expect(sanitizeForLog(input)).toBe(input);
  });

  it('does not redact partial Google prefix without sufficient length', () => {
    const input = 'AIza is just a prefix';
    expect(sanitizeForLog(input)).toBe(input);
  });
});
