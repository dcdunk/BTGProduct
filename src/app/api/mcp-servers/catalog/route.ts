import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMcpServers } from '@/lib/db';
import { MCP_OAUTH_CATALOG } from '@/lib/mcp/oauth-catalog';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingServers = getMcpServers();
  const existingSlugs = new Set(existingServers.map(s => s.slug));

  const catalog = MCP_OAUTH_CATALOG.map(template => ({
    ...template,
    alreadyAdded: existingSlugs.has(template.slug),
  }));

  return Response.json(catalog);
}
