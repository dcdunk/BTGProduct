import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllAgentsWithActivity } from '@/lib/db';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import AgentCard from '@/components/dashboard/AgentCard';
import type { AgentWithActivity } from '@/types';

export default async function AgentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const agents = getAllAgentsWithActivity() as AgentWithActivity[];

  return (
    <div className="p-8 animate-page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary">
            Agents
          </h1>
          <p className="text-secondary text-sm mt-1">
            Manage your AI agents
          </p>
        </div>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Agent
        </Link>
      </div>

      {agents.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} showEdit />
          ))}
        </div>
      )}
    </div>
  );
}
