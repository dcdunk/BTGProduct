import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTemplateBySlug, updateTemplate, deleteTemplate } from '@/lib/db';

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const template = getTemplateBySlug(params.slug);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const template = getTemplateBySlug(params.slug);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, icon_emoji, format, category, content } = body;

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
  }

  if (format !== undefined && !['markdown', 'structured'].includes(format)) {
    return NextResponse.json({ error: 'Format must be markdown or structured' }, { status: 400 });
  }

  updateTemplate(template.id, {
    name: name?.trim(),
    description: description?.trim() || null,
    icon_emoji,
    format,
    category: category?.trim() || null,
    content: content?.trim(),
  });

  const updated = getTemplateBySlug(params.slug);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ slug: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const template = getTemplateBySlug(params.slug);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  deleteTemplate(template.id);
  return NextResponse.json({ success: true });
}
