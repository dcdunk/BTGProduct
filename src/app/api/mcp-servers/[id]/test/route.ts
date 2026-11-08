import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServerById, getUserByEmail } from '@/lib/db';
import { mcpManager } from '@/lib/mcp/client-manager';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = getUserByEmail(session.user.email);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const server = getMcpServerById(params.id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    // Disconnect any existing connection first (force reconnect for testing)
    await mcpManager.disconnect(server.id);
    const tools = await mcpManager.connect(server);
    const toolNames = tools.map(t => t.name);
    return NextResponse.json({ success: true, tools: toolNames });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
