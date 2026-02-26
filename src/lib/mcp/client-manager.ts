import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpOAuthProvider } from './oauth-provider';
import { getOAuthTokens } from '@/lib/db';
import type { McpServer } from '@/types';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  mcpServerId: string;
  mcpServerName: string;
}

export interface ToolCallResult {
  content: string;
  isError: boolean;
}

interface MCPConnection {
  client: Client;
  tools: ToolDefinition[];
  lastUsed: number;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

class McpClientManager {
  private connections = new Map<string, MCPConnection>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodically clean up idle connections
    this.cleanupTimer = setInterval(() => this.cleanupIdle(), 60_000);
  }

  private connectionKey(serverId: string, userId?: string, authType?: string): string {
    // OAuth connections are per-user; others are shared
    return authType === 'oauth' && userId ? `${serverId}:${userId}` : serverId;
  }

  async connect(server: McpServer, userId?: string): Promise<ToolDefinition[]> {
    const key = this.connectionKey(server.id, userId, server.auth_type);

    // Return cached connection if available
    const existing = this.connections.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.tools;
    }

    const client = new Client(
      { name: 'mission-control', version: '1.0.0' },
      { capabilities: {} }
    );

    let transport;
    if (server.transport_type === 'stdio') {
      if (!server.command) throw new Error('Stdio server requires a command');
      const args = server.args ? JSON.parse(server.args) as string[] : [];
      const env = server.env ? JSON.parse(server.env) as Record<string, string> : undefined;
      transport = new StdioClientTransport({
        command: server.command,
        args,
        env: env ? { ...process.env as Record<string, string>, ...env } : undefined,
      });
    } else if (server.transport_type === 'sse') {
      if (!server.url) throw new Error('SSE server requires a URL');
      const headers = server.headers ? JSON.parse(server.headers) as Record<string, string> : undefined;
      transport = new SSEClientTransport(
        new URL(server.url),
        headers ? { requestInit: { headers } } : undefined,
      );
    } else if (server.transport_type === 'streamable_http') {
      if (!server.url) throw new Error('Streamable HTTP server requires a URL');

      if (server.auth_type === 'oauth' && userId) {
        const authProvider = new McpOAuthProvider({
          userId,
          mcpServerId: server.id,
          serverUrl: server.url,
          clientId: server.oauth_client_id ?? undefined,
          scopes: server.oauth_scopes ?? undefined,
        });
        transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          { authProvider },
        );
      } else {
        const headers = server.headers ? JSON.parse(server.headers) as Record<string, string> : undefined;
        transport = new StreamableHTTPClientTransport(
          new URL(server.url),
          headers ? { requestInit: { headers } } : undefined,
        );
      }
    } else {
      throw new Error(`Unknown transport type: ${server.transport_type}`);
    }

    await client.connect(transport);

    // List available tools
    const result = await client.listTools();
    const tools: ToolDefinition[] = (result.tools || []).map(t => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema as Record<string, unknown>,
      mcpServerId: server.id,
      mcpServerName: server.name,
    }));

    this.connections.set(key, { client, tools, lastUsed: Date.now() });
    return tools;
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>, userId?: string): Promise<ToolCallResult> {
    // Try user-specific key first, then shared key
    const userKey = userId ? `${serverId}:${userId}` : serverId;
    const connection = this.connections.get(userKey) || this.connections.get(serverId);
    if (!connection) {
      throw new Error(`No connection for server ${serverId}`);
    }

    connection.lastUsed = Date.now();

    try {
      const result = await connection.client.callTool({ name: toolName, arguments: args });
      // Extract text content from result
      const textParts = (result.content as Array<{ type: string; text?: string }>)
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text!);
      return {
        content: textParts.join('\n') || JSON.stringify(result.content),
        isError: result.isError === true,
      };
    } catch (err) {
      return {
        content: err instanceof Error ? err.message : 'Tool call failed',
        isError: true,
      };
    }
  }

  async disconnect(connectionKey: string): Promise<void> {
    const connection = this.connections.get(connectionKey);
    if (connection) {
      try {
        await connection.client.close();
      } catch {
        // Ignore close errors
      }
      this.connections.delete(connectionKey);
    }
  }

  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.all(ids.map(id => this.disconnect(id)));
  }

  async getToolsForAgent(servers: McpServer[], userId?: string): Promise<ToolDefinition[]> {
    const allTools: ToolDefinition[] = [];
    for (const server of servers) {
      if (!server.is_active) continue;

      // Skip OAuth servers where user hasn't connected
      if (server.auth_type === 'oauth' && userId) {
        const tokens = getOAuthTokens(userId, server.id);
        if (!tokens) continue;
      }

      try {
        const tools = await this.connect(server, userId);
        allTools.push(...tools);
      } catch (err) {
        console.error(`Failed to connect to MCP server "${server.name}":`, err instanceof Error ? err.message : err);
      }
    }
    return allTools;
  }

  findServerForTool(toolName: string): string | null {
    for (const [serverId, connection] of Array.from(this.connections.entries())) {
      if (connection.tools.some(t => t.name === toolName)) {
        // Return just the server ID (strip :userId suffix if present)
        return serverId.includes(':') ? serverId.split(':')[0] : serverId;
      }
    }
    return null;
  }

  private cleanupIdle(): void {
    const now = Date.now();
    for (const [key, connection] of Array.from(this.connections.entries())) {
      if (now - connection.lastUsed > IDLE_TIMEOUT_MS) {
        this.disconnect(key);
      }
    }
  }
}

export const mcpManager = new McpClientManager();
