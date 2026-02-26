import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserOAuthStatuses } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const statuses = getUserOAuthStatuses(userId);
  return Response.json({ statuses });
}
