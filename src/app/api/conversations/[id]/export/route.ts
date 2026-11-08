import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversationById, getMessagesByConversationId, getAgentById } from '@/lib/db';
import type { Agent } from '@/types';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const conversation = getConversationById(params.id);
  if (!conversation || conversation.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = getMessagesByConversationId(params.id);
  const agent = getAgentById(conversation.agent_id) as Agent | undefined;
  const agentName = agent?.name ?? 'Agent';
  const agentSlug = agent?.slug ?? 'agent';

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'markdown';
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const data = {
      agent: { name: agentName, slug: agentSlug },
      conversation: { title: conversation.title, created_at: conversation.created_at },
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })),
      exported_at: new Date().toISOString(),
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${agentSlug}-${dateStr}.json"`,
      },
    });
  }

  // Markdown format
  const lines: string[] = [
    `# ${agentName} - ${conversation.title || 'Conversation'}`,
    `Date: ${conversation.created_at}`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'You' : agentName;
    const ts = new Date(msg.created_at + 'Z').toLocaleString();
    lines.push(`**${sender}** (${ts})`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${agentSlug}-${dateStr}.md"`,
    },
  });
}
