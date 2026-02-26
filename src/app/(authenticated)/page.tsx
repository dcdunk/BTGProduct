import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import AgentGrid from '@/components/dashboard/AgentGrid';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="p-8 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary">
            Welcome, {firstName}
          </h1>
          <p className="text-secondary text-sm mt-1">
            Select an agent to start a conversation
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

      {/* Agent Grid */}
      <AgentGrid />
    </div>
  );
}
