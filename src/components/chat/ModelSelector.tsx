'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { PROVIDER_MODELS, PROVIDER_DISPLAY_NAMES, type Provider } from '@/types';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
}

export default function ModelSelector({ provider, model, onChange }: ModelSelectorProps) {
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

  // Display short model name
  const displayModel = model.split('/').pop() || model;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-secondary hover:text-primary hover:bg-surface-hover transition-colors uppercase tracking-wider font-mono"
        title="Select model"
      >
        <span className="truncate max-w-[160px]">{displayModel}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-64 bg-elevated border border-subtle rounded-lg shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {(Object.keys(PROVIDER_MODELS) as Provider[]).map(p => (
            <div key={p}>
              <div className="px-3 py-1.5 text-[10px] text-tertiary uppercase tracking-widest font-mono">
                {PROVIDER_DISPLAY_NAMES[p]}
              </div>
              {PROVIDER_MODELS[p].map(m => (
                <button
                  key={m}
                  onClick={() => {
                    onChange(p, m);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm font-mono transition-colors ${
                    provider === p && model === m
                      ? 'text-cyan bg-cyan/10'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
