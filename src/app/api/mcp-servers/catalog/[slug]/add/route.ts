import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createMcpServer, getUserByEmail } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { MCP_OAUTH_CATALOG } from '@/lib/mcp/oauth-catalog';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = getUserByEmail(session.user.email);
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const template = MCP_OAUTH_CATALOG.find(t => t.slug === params.slug);
  if (!template) {
    return Response.json({ error: 'Service not found in catalog' }, { status: 404 });
  }

  let clientId: string | null = null;
  let clientSecretEnc: string | null = null;
  let clientSecretIv: string | null = null;
  let clientSecretTag: string | null = null;

  // For services that require pre-registration, accept client credentials
  if (template.requiresClientRegistration) {
    let body: { clientId?: string; clientSecret?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Client ID is required for this service' }, { status: 400 });
    }

    if (!body.clientId) {
      return Response.json({ error: 'Client ID is required for this service' }, { status: 400 });
    }

    clientId = body.clientId;
    if (body.clientSecret) {
      const encrypted = encrypt(body.clientSecret);
      clientSecretEnc = encrypted.encrypted;
      clientSecretIv = encrypted.iv;
      clientSecretTag = encrypted.authTag;
    }
  }

  const server = createMcpServer({
    name: template.name,
    description: template.description,
    transport_type: template.transport_type,
    url: template.url,
    auth_type: template.auth_type,
    oauth_client_id: clientId,
    oauth_client_secret_enc: clientSecretEnc,
    oauth_client_secret_iv: clientSecretIv,
    oauth_client_secret_tag: clientSecretTag,
    oauth_scopes: template.oauth_scopes ?? null,
    created_by: user.id,
  });

  return Response.json(server, { status: 201 });
}
