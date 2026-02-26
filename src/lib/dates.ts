/**
 * Parse a timestamp string into a Date object.
 * Handles both SQLite format ("2026-02-20 22:00:00") and ISO 8601 ("2026-02-20T22:00:00.000Z").
 * SQLite timestamps are treated as UTC.
 */
export function parseTimestamp(value: string): Date {
  // If it already has a timezone indicator, parse directly
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  // SQLite CURRENT_TIMESTAMP format — append Z to treat as UTC
  return new Date(value + 'Z');
}
