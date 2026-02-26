'use client';

import Link from 'next/link';
import type { Skill } from '@/types';

interface SkillCardProps {
  skill: Skill & { agent_count: number };
}

export default function SkillCard({ skill }: SkillCardProps) {
  return (
    <Link href={`/skills/${skill.slug}/edit`}>
      <div className="group bg-elevated border border-subtle rounded-lg p-5 transition-all duration-200 hover:border-cyan hover:shadow-glow-cyan-subtle hover:-translate-y-0.5 cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[32px] leading-none">{skill.icon_emoji}</span>
          {skill.category && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-elevated text-tertiary border border-subtle">
              {skill.category}
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-display text-base font-medium uppercase tracking-wider text-primary mb-1.5 group-hover:text-cyan transition-colors">
          {skill.name}
        </h3>

        {/* Description */}
        <p className="text-secondary text-sm leading-relaxed line-clamp-2 flex-1">
          {skill.description || 'No description'}
        </p>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <span className="text-xs text-tertiary uppercase tracking-wider">
            Used by {skill.agent_count} {skill.agent_count === 1 ? 'agent' : 'agents'}
          </span>
        </div>
      </div>
    </Link>
  );
}
