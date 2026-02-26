import 'server-only';
import { randomBytes } from 'crypto';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  getOAuthTokens,
  saveOAuthTokens,
  deleteOAuthTokens,
  createOAuthState,
  getOAuthState,
  updateOAuthStateVerifier,
  deleteOAuthState,
  getOAuthClientRegistration,
  saveOAuthClientRegistration,
  getMcpServerById,
  getMcpServerClientSecret,
} from '@/lib/db';

interface McpOAuthProviderOptions {
  userId: string;
  mcpServerId: string;
  serverUrl: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string;
}

/**
 * OAuthClientProvider implementation for Mission Control.
 * Backs OAuth state with SQLite and encrypts tokens via crypto.ts.
 *
 * For web apps, `redirectToAuthorization()` captures the URL instead of
 * performing a redirect. The calling API route reads it via `getPendingAuthUrl()`.
 */
export class McpOAuthProvider implements OAuthClientProvider {
  private userId: string;
  private mcpServerId: string;
  private serverUrl: string;
  private preConfiguredClientId?: string;
  private preConfiguredClientSecret?: string;
  private scopes?: string;
  private pendingAuthUrl: URL | null = null;
  private currentState: string | null = null;

  constructor(opts: McpOAuthProviderOptions) {
    this.userId = opts.userId;
    this.mcpServerId = opts.mcpServerId;
    this.serverUrl = opts.serverUrl;
    this.preConfiguredClientId = opts.clientId;
    this.preConfiguredClientSecret = opts.clientSecret;
    this.scopes = opts.scopes;
  }

  get redirectUrl(): string {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';
    return `${baseUrl}/api/mcp-servers/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: 'Mission Control',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      ...(this.scopes ? { scope: this.scopes } : {}),
    };
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    // 1. Check pre-configured client_id on the server record
    if (this.preConfiguredClientId) {
      return {
        client_id: this.preConfiguredClientId,
        ...(this.preConfiguredClientSecret ? { client_secret: this.preConfiguredClientSecret } : {}),
      };
    }

    // 2. Check for pre-configured credentials on the MCP server record itself
    const server = getMcpServerById(this.mcpServerId);
    if (server?.oauth_client_id) {
      const clientSecret = getMcpServerClientSecret(this.mcpServerId);
      return {
        client_id: server.oauth_client_id,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      };
    }

    // 3. Check for dynamic client registration result
    const registration = getOAuthClientRegistration(this.mcpServerId);
    if (registration) {
      return {
        client_id: registration.client_id,
        ...(registration.client_secret ? { client_secret: registration.client_secret } : {}),
        ...(registration.client_id_issued_at ? { client_id_issued_at: registration.client_id_issued_at } : {}),
        ...(registration.client_secret_expires_at ? { client_secret_expires_at: registration.client_secret_expires_at } : {}),
      };
    }

    // No client info — triggers dynamic client registration
    return undefined;
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    saveOAuthClientRegistration(this.mcpServerId, {
      client_id: clientInformation.client_id,
      client_secret: (clientInformation as { client_secret?: string }).client_secret ?? null,
      client_id_issued_at: (clientInformation as { client_id_issued_at?: number }).client_id_issued_at ?? null,
      client_secret_expires_at: (clientInformation as { client_secret_expires_at?: number }).client_secret_expires_at ?? null,
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const stored = getOAuthTokens(this.userId, this.mcpServerId);
    if (!stored) return undefined;

    return {
      access_token: stored.access_token,
      token_type: stored.token_type,
      ...(stored.refresh_token ? { refresh_token: stored.refresh_token } : {}),
      ...(stored.scope ? { scope: stored.scope } : {}),
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    saveOAuthTokens(this.userId, this.mcpServerId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_type: tokens.token_type,
      scope: tokens.scope ?? null,
      expires_in: tokens.expires_in ?? null,
    });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    // Web app: capture the URL for the API route to return to the frontend
    this.pendingAuthUrl = authorizationUrl;
  }

  async state(): Promise<string> {
    const stateToken = randomBytes(32).toString('hex');
    this.currentState = stateToken;
    createOAuthState({
      userId: this.userId,
      mcpServerId: this.mcpServerId,
      state: stateToken,
    });
    return stateToken;
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    // Update the most recent state record with the code verifier
    if (this.currentState) {
      updateOAuthStateVerifier(this.currentState, codeVerifier);
    }
  }

  async codeVerifier(): Promise<string> {
    if (this.currentState) {
      const stateRecord = getOAuthState(this.currentState);
      if (stateRecord) return stateRecord.code_verifier;
    }
    return '';
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
    if (scope === 'all' || scope === 'tokens') {
      deleteOAuthTokens(this.userId, this.mcpServerId);
    }
    if (scope === 'all' || scope === 'verifier') {
      if (this.currentState) {
        deleteOAuthState(this.currentState);
      }
    }
  }

  /** Read the pending auth URL after SDK calls redirectToAuthorization */
  getPendingAuthUrl(): URL | null {
    return this.pendingAuthUrl;
  }

  /** Set the current state for code verifier lookup during callback */
  setCurrentState(state: string): void {
    this.currentState = state;
  }
}
