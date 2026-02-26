'use client';

import { useState, useEffect, useRef } from 'react';
import { Plug } from 'lucide-react';
import type { McpServer } from '@/types';

interface McpServerTogglesProps {
  servers: McpServer[];
  enabledIds: string[];
  onChange: (ids: string[]) => void;
}

export default function McpServerToggles({ servers, enabledIds, onChange }: McpServerTogglesProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (servers.length === 0) {
    return (
      <button
        className="p-1.5 rounded text-tertiary opacity-50 cursor-not-allowed"
        title="No MCP servers available"
        disabled
      >
        <Plug size={16} />
      </button>
    );
  }

  const enabledCount = enabledIds.length;

  const toggle = (serverId: string) => {
    if (enabledIds.includes(serverId)) {
      onChange(enabledIds.filter(id => id !== serverId));
    } else {
      onChange([...enabledIds, serverId]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded transition-colors ${
          enabledCount > 0
            ? 'text-cyan hover:text-cyan/80'
            : 'text-tertiary hover:text-secondary'
        }`}
        title={`MCP Servers (${enabledCount} active)`}
      >
        <Plug size={16} />
        {enabledCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan text-on-accent text-[9px] font-mono rounded-full flex items-center justify-center">
            {enabledCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-60 bg-elevated border border-subtle rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] text-tertiary uppercase tracking-widest font-mono">
            MCP Servers
          </div>
          {servers.map(server => {
            const isEnabled = enabledIds.includes(server.id);
            return (
              <button
                key={server.id}
                onClick={() => toggle(server.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  isEnabled
                    ? 'text-cyan bg-cyan/5'
                    : 'text-secondary hover:text-primary hover:bg-surface-hover'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isEnabled ? 'bg-cyan' : 'bg-subtle'}`} />
                <span className="truncate">{server.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
