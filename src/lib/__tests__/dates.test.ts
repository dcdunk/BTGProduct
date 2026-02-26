import { describe, it, expect } from 'vitest';
import { parseTimestamp } from '../dates';

describe('parseTimestamp', () => {
  it('parses SQLite CURRENT_TIMESTAMP format as UTC', () => {
    const date = parseTimestamp('2026-02-20 15:30:00');
    expect(date.toISOString()).toBe('2026-02-20T15:30:00.000Z');
  });

  it('parses ISO 8601 format with Z suffix', () => {
    const date = parseTimestamp('2026-02-20T15:30:00.000Z');
    expect(date.toISOString()).toBe('2026-02-20T15:30:00.000Z');
  });

  it('does not double-append Z to ISO strings', () => {
    // This was the original bug — appending Z to a string already ending in Z
    const date = parseTimestamp('2026-02-20T15:30:00.123Z');
    expect(date.getTime()).not.toBeNaN();
    expect(date.toISOString()).toBe('2026-02-20T15:30:00.123Z');
  });

  it('handles ISO 8601 with timezone offset', () => {
    const date = parseTimestamp('2026-02-20T15:30:00+05:00');
    expect(date.getTime()).not.toBeNaN();
    expect(date.toISOString()).toBe('2026-02-20T10:30:00.000Z');
  });

  it('handles ISO 8601 with negative timezone offset', () => {
    const date = parseTimestamp('2026-02-20T15:30:00-03:00');
    expect(date.getTime()).not.toBeNaN();
    expect(date.toISOString()).toBe('2026-02-20T18:30:00.000Z');
  });

  it('handles SQLite format with fractional seconds', () => {
    const date = parseTimestamp('2026-02-20 15:30:00.500');
    expect(date.getTime()).not.toBeNaN();
  });
});
