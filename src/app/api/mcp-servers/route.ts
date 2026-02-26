import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServers, createMcpServer, getUserByEmail } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const servers = getMcpServers();
  return NextResponse.json(servers);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserByEmail(session.user.email);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, transport_type, command, args, env, url, headers } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!['stdio', 'sse'].includes(transport_type)) {
    return NextResponse.json({ error: 'Invalid transport type' }, { status: 400 });
  }

  const server = createMcpServer({
    name: name.trim(),
    description: description?.trim() || null,
    transport_type,
    command: command?.trim() || null,
    args: args || null,
    env: env || null,
    url: url?.trim() || null,
    headers: headers || null,
    created_by: user.id,
  });

  return NextResponse.json(server, { status: 201 });
}
