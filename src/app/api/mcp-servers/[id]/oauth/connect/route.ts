import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServerById } from '@/lib/db';
import { McpOAuthProvider } from '@/lib/mcp/oauth-provider';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const server = getMcpServerById(params.id);
  if (!server) {
    return Response.json({ error: 'MCP server not found' }, { status: 404 });
  }
  if (server.auth_type !== 'oauth') {
    return Response.json({ error: 'Server does not use OAuth' }, { status: 400 });
  }
  if (!server.url) {
    return Response.json({ error: 'Server URL is required for OAuth' }, { status: 400 });
  }

  const provider = new McpOAuthProvider({
    userId,
    mcpServerId: server.id,
    serverUrl: server.url,
    clientId: server.oauth_client_id ?? undefined,
    scopes: server.oauth_scopes ?? undefined,
  });

  try {
    const result = await auth(provider, {
      serverUrl: server.url,
      scope: server.oauth_scopes ?? undefined,
    });

    if (result === 'AUTHORIZED') {
      return Response.json({ alreadyConnected: true });
    }

    // result === 'REDIRECT'
    const authUrl = provider.getPendingAuthUrl();
    if (!authUrl) {
      return Response.json({ error: 'Failed to generate authorization URL' }, { status: 500 });
    }

    return Response.json({ authorizationUrl: authUrl.toString() });
  } catch (err) {
    console.error('OAuth connect error:', err instanceof Error ? err.message : err);
    return Response.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
