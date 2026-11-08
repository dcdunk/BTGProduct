import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConversationById, setActiveTemplate } from '@/lib/db';

export async function PUT(
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

  const body = await request.json();
  const { templateId } = body;

  setActiveTemplate(params.id, templateId || null);
  return NextResponse.json({ success: true, active_template_id: templateId || null });
}
