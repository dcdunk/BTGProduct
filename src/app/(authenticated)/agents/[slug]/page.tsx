import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentBySlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import ChatInterface from '@/components/chat/ChatInterface';
import type { Agent } from '@/types';

interface PageProps {
  params: { slug: string };
}

export default async function AgentChatPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null; // AuthGuard handles redirect

  const agent = getAgentBySlug(params.slug) as Agent | undefined;
  if (!agent) notFound();

  return (
    <Suspense>
      <ChatInterface agent={agent} />
    </Suspense>
  );
}
