import AgentForm from '@/components/agents/AgentForm';

export default function NewAgentPage() {
  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Create Agent
      </h1>
      <AgentForm mode="create" />
    </div>
  );
}
