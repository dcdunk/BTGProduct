import { getAgentBySlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import AgentForm from '@/components/agents/AgentForm';
import type { Agent } from '@/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditAgentPage(props: PageProps) {
  const params = await props.params;
  const agent = getAgentBySlug(params.slug) as Agent | undefined;
  if (!agent) notFound();

  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Edit {agent.name}
      </h1>
      <AgentForm mode="edit" agent={agent} />
    </div>
  );
}
