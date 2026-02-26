'use client';

import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import type { Template } from '@/types';

interface TemplatePickerProps {
  agentId: string;
  activeTemplateId: string | null;
  conversationId: string | null;
  onTemplateChange: (templateId: string | null) => void;
}

type TemplateWithSort = Template & { sort_order: number };

export default function TemplatePicker({ agentId, activeTemplateId, conversationId, onTemplateChange }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateWithSort[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, [agentId]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (templates.length === 0) return null;

  const activeTemplate = templates.find(t => t.id === activeTemplateId);
  const disabled = !conversationId;

  const handleSelect = async (templateId: string | null) => {
    if (!conversationId) return;
    setOpen(false);
    try {
      await fetch(`/api/conversations/${conversationId}/template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      onTemplateChange(templateId);
    } catch {
      // Silently fail
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs uppercase tracking-wider font-mono transition-all ${
          activeTemplate
            ? 'bg-cyan/15 text-cyan border border-cyan/30'
            : 'text-tertiary hover:text-secondary border border-transparent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={disabled ? 'Start a conversation first' : activeTemplate ? activeTemplate.name : 'Select template'}
      >
        <FileText size={14} />
        <span className="max-w-[120px] truncate">
          {activeTemplate ? activeTemplate.name : 'Template'}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-elevated border border-subtle rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => handleSelect(null)}
            className={`w-full text-left px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              !activeTemplateId ? 'text-cyan bg-cyan/10' : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            None
          </button>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                activeTemplateId === t.id ? 'text-cyan bg-cyan/10' : 'text-secondary hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <span>{t.icon_emoji}</span>
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
