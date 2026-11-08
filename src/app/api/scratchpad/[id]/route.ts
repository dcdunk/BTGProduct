import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScratchpadItemById, updateScratchpadItem, deleteScratchpadItem } from '@/lib/db';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const item = getScratchpadItemById(params.id);
  if (!item || item.created_by !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

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

  const item = getScratchpadItemById(params.id);
  if (!item || item.created_by !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const { title, content } = body;

  updateScratchpadItem(params.id, {
    title: title?.trim(),
    content: content?.trim(),
  });

  const updated = getScratchpadItemById(params.id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const item = getScratchpadItemById(params.id);
  if (!item || item.created_by !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteScratchpadItem(params.id);
  return NextResponse.json({ success: true });
}
