import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScratchpadItems, createScratchpadItem } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const items = getScratchpadItems(userId);
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { title, content, sourceAgentId, sourceConversationId } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const item = createScratchpadItem({
    title: title.trim(),
    content: content.trim(),
    sourceAgentId: sourceAgentId || undefined,
    sourceConversationId: sourceConversationId || undefined,
    createdBy: userId,
  });

  return NextResponse.json(item, { status: 201 });
}
