import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchMessages } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const agentId = searchParams.get('agentId') || undefined;

  if (!q?.trim()) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const results = searchMessages(userId, q.trim(), agentId);
  return NextResponse.json(results);
}
