'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Copy } from 'lucide-react';
import type { AgentWithActivity } from '@/types';
import { PROVIDER_DISPLAY_NAMES, type Provider } from '@/types';

const providerColorClasses: Record<Provider, string> = {
  anthropic: 'bg-provider-anthropic/15 text-provider-anthropic',
  openai: 'bg-provider-openai/15 text-provider-openai',
  google: 'bg-provider-google/15 text-provider-google',
};

interface AgentCardProps {
  agent: AgentWithActivity;
  showEdit?: boolean;
  onDuplicate?: (agentId: string) => void;
}

export default function AgentCard({ agent, showEdit, onDuplicate }: AgentCardProps) {
  const lastActive = agent.last_active
    ? formatDistanceToNow(new Date(agent.last_active + 'Z'), { addSuffix: true })
    : null;

  return (
    <Link href={`/agents/${agent.slug}`}>
      <div className="group bg-elevated border border-subtle rounded-lg p-5 transition-all duration-200 hover:border-cyan hover:shadow-glow-cyan-subtle hover:-translate-y-0.5 cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[32px] leading-none">{agent.avatar_emoji}</span>
          <div className="flex items-center gap-2">
            {onDuplicate && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onDuplicate(agent.id); }}
                className="p-1.5 rounded text-tertiary hover:text-cyan opacity-0 group-hover:opacity-100 transition-all"
                aria-label={`Duplicate ${agent.name}`}
              >
                <Copy size={14} />
              </button>
            )}
            {showEdit && (
              <Link
                href={`/agents/${agent.slug}/edit`}
                onClick={e => e.stopPropagation()}
                className="p-1.5 rounded text-tertiary hover:text-cyan opacity-0 group-hover:opacity-100 transition-all"
                aria-label={`Edit ${agent.name}`}
              >
                <Pencil size={14} />
              </Link>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${providerColorClasses[agent.provider]}`}
            >
              {PROVIDER_DISPLAY_NAMES[agent.provider]}
            </span>
          </div>
        </div>

        {/* Name */}
        <h3 className="font-display text-base font-medium uppercase tracking-wider text-primary mb-1.5 group-hover:text-cyan transition-colors">
          {agent.name}
        </h3>

        {/* Description */}
        <p className="text-secondary text-sm leading-relaxed line-clamp-2 flex-1">
          {agent.description || 'No description'}
        </p>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-subtle">
          <span className="text-xs text-tertiary uppercase tracking-wider">
            {lastActive ? `Active ${lastActive}` : 'No conversations yet'}
          </span>
        </div>
      </div>
    </Link>
  );
}
