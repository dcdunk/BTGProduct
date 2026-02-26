import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversationById, getConversationMcpServers, setConversationMcpServers } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const conversation = getConversationById(params.id);
  if (!conversation || conversation.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const servers = getConversationMcpServers(params.id);
  return NextResponse.json(servers);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const conversation = getConversationById(params.id);
  if (!conversation || conversation.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { serverIds } = body;

  if (!Array.isArray(serverIds)) {
    return NextResponse.json({ error: 'serverIds must be an array' }, { status: 400 });
  }

  setConversationMcpServers(params.id, serverIds);
  return NextResponse.json({ success: true });
}
