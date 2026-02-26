'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import AgentCard from './AgentCard';
import type { AgentWithActivity } from '@/types';

export default function AgentGrid() {
  const [agents, setAgents] = useState<AgentWithActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = () => {
    fetch('/api/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleDuplicate = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/duplicate`, { method: 'POST' });
      if (res.ok) fetchAgents();
    } catch {
      // Silently fail
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-elevated border border-subtle rounded-lg p-5 h-[200px] animate-pulse"
          >
            <div className="w-8 h-8 bg-surface-hover rounded mb-3" />
            <div className="w-2/3 h-4 bg-surface-hover rounded mb-2" />
            <div className="w-full h-3 bg-surface-hover rounded mb-1" />
            <div className="w-4/5 h-3 bg-surface-hover rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl mb-4">🤖</span>
        <h2 className="font-display text-lg font-medium uppercase tracking-wider text-primary mb-2">
          No agents yet
        </h2>
        <p className="text-secondary text-sm mb-6">
          Create your first AI agent to get started.
        </p>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          Create Agent
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} onDuplicate={handleDuplicate} />
      ))}
    </div>
  );
}
