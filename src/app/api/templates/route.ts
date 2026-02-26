import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllTemplates, createTemplate } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = getAllTemplates();
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { name, description, icon_emoji, format, category, content } = body;

  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
  }

  if (format && !['markdown', 'structured'].includes(format)) {
    return NextResponse.json({ error: 'Format must be markdown or structured' }, { status: 400 });
  }

  const template = createTemplate({
    name: name.trim(),
    description: description?.trim() || undefined,
    icon_emoji: icon_emoji || undefined,
    format: format || 'markdown',
    category: category?.trim() || undefined,
    content: content.trim(),
    created_by: userId,
  });

  return NextResponse.json(template, { status: 201 });
}
