import { NextResponse } from 'next/server';
import {
  getOAuthState,
  deleteOAuthState,
  cleanExpiredOAuthStates,
  getMcpServerById,
} from '@/lib/db';
import { McpOAuthProvider } from '@/lib/mcp/oauth-provider';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
  const settingsUrl = `${baseUrl}/settings?tab=mcp-servers`;

  // Clean up expired states on every callback
  cleanExpiredOAuthStates();

  if (error) {
    const desc = url.searchParams.get('error_description') || error;
    return NextResponse.redirect(`${settingsUrl}&error=${encodeURIComponent(desc)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}&error=missing_params`);
  }

  // Look up the state record
  const stateRecord = getOAuthState(state);
  if (!stateRecord) {
    return NextResponse.redirect(`${settingsUrl}&error=invalid_or_expired_state`);
  }

  const server = getMcpServerById(stateRecord.mcp_server_id);
  if (!server || !server.url) {
    deleteOAuthState(state);
    return NextResponse.redirect(`${settingsUrl}&error=server_not_found`);
  }

  // Create provider with the stored state context
  const provider = new McpOAuthProvider({
    userId: stateRecord.user_id,
    mcpServerId: server.id,
    serverUrl: server.url,
    clientId: server.oauth_client_id ?? undefined,
    scopes: server.oauth_scopes ?? undefined,
  });
  provider.setCurrentState(state);

  try {
    const result = await auth(provider, {
      serverUrl: server.url,
      authorizationCode: code,
      scope: server.oauth_scopes ?? undefined,
    });

    // Clean up state regardless of result
    deleteOAuthState(state);

    if (result === 'AUTHORIZED') {
      return NextResponse.redirect(`${settingsUrl}&connected=true`);
    }

    // Shouldn't reach here with a valid code, but handle gracefully
    return NextResponse.redirect(`${settingsUrl}&error=authorization_failed`);
  } catch (err) {
    console.error('OAuth callback error:', err instanceof Error ? err.message : err);
    deleteOAuthState(state);
    return NextResponse.redirect(`${settingsUrl}&error=token_exchange_failed`);
  }
}
