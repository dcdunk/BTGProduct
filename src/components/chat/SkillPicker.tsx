'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import type { Skill } from '@/types';

interface SkillPickerProps {
  agentId: string;
  onSkillSelect: (skillSlug: string) => void;
}

type SkillWithMode = Skill & { mode: string; sort_order: number };

export default function SkillPicker({ agentId, onSkillSelect }: SkillPickerProps) {
  const [skills, setSkills] = useState<SkillWithMode[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agents/${agentId}/skills`)
      .then(r => r.json())
      .then((data: SkillWithMode[]) => setSkills(data.filter(s => s.mode === 'on_demand')))
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

  if (skills.length === 0) {
    return (
      <button
        className="p-1.5 rounded text-tertiary opacity-50 cursor-not-allowed"
        title="No on-demand skills available"
        disabled
      >
        <Zap size={18} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded text-tertiary hover:text-cyan transition-colors"
        title="Use a skill"
      >
        <Zap size={18} />
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-56 bg-elevated border border-subtle rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => {
                onSkillSelect(skill.slug);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
            >
              <span>{skill.icon_emoji}</span>
              <span className="truncate">{skill.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
