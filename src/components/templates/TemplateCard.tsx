'use client';

import Link from 'next/link';
import type { Template } from '@/types';

interface TemplateCardProps {
  template: Template & { agent_count: number };
}

const formatBadgeClasses: Record<string, string> = {
  markdown: 'bg-cyan/15 text-cyan',
  structured: 'bg-magenta/15 text-magenta',
};

export default function TemplateCard({ template }: TemplateCardProps) {
  return (
    <Link href={`/templates/${template.slug}/edit`}>
      <div className="group bg-elevated border border-subtle rounded-lg p-5 transition-all duration-200 hover:border-cyan hover:shadow-glow-cyan-subtle hover:-translate-y-0.5 cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[32px] leading-none">{template.icon_emoji}</span>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${formatBadgeClasses[template.format] || ''}`}>
              {template.format}
            </span>
            {template.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-elevated text-tertiary border border-subtle">
                {template.category}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <h3 className="font-display text-base font-medium uppercase tracking-wider text-primary mb-1.5 group-hover:text-cyan transition-colors">
          {template.name}
        </h3>

        {/* Description */}
        <p className="text-secondary text-sm leading-relaxed line-clamp-2 flex-1">
          {template.description || 'No description'}
        </p>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <span className="text-xs text-tertiary uppercase tracking-wider">
            Used by {template.agent_count} {template.agent_count === 1 ? 'agent' : 'agents'}
          </span>
        </div>
      </div>
    </Link>
  );
}
