import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllApiKeyStatuses, setApiKey } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statuses = getAllApiKeyStatuses();
  return NextResponse.json(statuses);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await request.json();
  const { provider, key } = body;

  if (!provider || !['anthropic', 'openai', 'google'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  if (!key?.trim()) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  setApiKey(provider, key.trim(), userId);
  return NextResponse.json({ success: true });
}
