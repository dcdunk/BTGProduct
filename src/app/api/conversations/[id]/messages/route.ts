import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversationById, getMessagesByConversationId } from '@/lib/db';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const conversation = getConversationById(params.id);
  if (!conversation || conversation.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = getMessagesByConversationId(params.id);
  return NextResponse.json(messages);
}
