import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteApiKey } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: { provider: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['anthropic', 'openai', 'google'].includes(params.provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  deleteApiKey(params.provider);
  return NextResponse.json({ success: true });
}
