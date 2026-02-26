import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServerById, deleteOAuthTokens } from '@/lib/db';
import { mcpManager } from '@/lib/mcp/client-manager';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const server = getMcpServerById(params.id);
  if (!server) {
    return Response.json({ error: 'MCP server not found' }, { status: 404 });
  }

  // Delete tokens
  deleteOAuthTokens(userId, server.id);

  // Disconnect any active connection for this user+server
  try {
    await mcpManager.disconnect(`${server.id}:${userId}`);
  } catch {
    // Ignore disconnect errors
  }

  return Response.json({ success: true });
}
