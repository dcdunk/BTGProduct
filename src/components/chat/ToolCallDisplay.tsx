'use client';

export interface ActiveToolCall {
  name: string;
  arguments: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: string;
}

interface ToolCallDisplayProps {
  tools: ActiveToolCall[];
}

export default function ToolCallDisplay({ tools }: ToolCallDisplayProps) {
  if (tools.length === 0) return null;

  return (
    <div className="max-w-3xl mx-auto mb-4">
      <div className="rounded-lg border border-subtle bg-base-raised overflow-hidden">
        {tools.map((tool, i) => (
          <div
            key={`${tool.name}-${i}`}
            className={`px-4 py-3 ${i > 0 ? 'border-t border-subtle' : ''}`}
          >
            <div className="flex items-center gap-2">
              {tool.status === 'running' && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
              )}
              {tool.status === 'done' && (
                <span className="text-green text-sm">&#10003;</span>
              )}
              {tool.status === 'error' && (
                <span className="text-magenta text-sm">&#10007;</span>
              )}
              <span className="font-mono text-xs text-secondary uppercase tracking-wider">
                {tool.name}
              </span>
              {Object.keys(tool.arguments).length > 0 && (
                <span className="font-mono text-xs text-tertiary truncate max-w-[300px]">
                  ({formatArgs(tool.arguments)})
                </span>
              )}
            </div>
            {tool.result && (
              <div className="mt-2 text-xs text-tertiary font-mono whitespace-pre-wrap break-words max-h-24 overflow-y-auto pl-5.5">
                {tool.result.length > 500 ? tool.result.slice(0, 500) + '...' : tool.result}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  return entries
    .map(([k, v]) => {
      const val = typeof v === 'string' ? `"${v.length > 40 ? v.slice(0, 40) + '...' : v}"` : String(v);
      return `${k}: ${val}`;
    })
    .join(', ');
}
