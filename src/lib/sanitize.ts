const KEY_PATTERNS = [
  /sk-ant-api\S+/g,         // Anthropic keys
  /sk-proj-\S+/g,           // OpenAI project keys
  /sk-\S{20,}/g,            // OpenAI legacy keys
  /AIza\S{30,}/g,           // Google AI keys
];

export function sanitizeForLog(text: string): string {
  let result = text;
  for (const pattern of KEY_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_API_KEY]');
  }
  return result;
}
