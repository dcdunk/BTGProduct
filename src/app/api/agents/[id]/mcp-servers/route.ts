import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentById, getAgentMcpServers, setAgentMcpServers } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const servers = getAgentMcpServers(params.id);
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

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { serverIds } = await request.json();
  if (!Array.isArray(serverIds)) {
    return NextResponse.json({ error: 'serverIds array required' }, { status: 400 });
  }

  setAgentMcpServers(params.id, serverIds);
  const updated = getAgentMcpServers(params.id);
  return NextResponse.json(updated);
}
