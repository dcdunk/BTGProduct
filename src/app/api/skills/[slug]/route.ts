import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSkillBySlug, updateSkill, deleteSkill } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skill = getSkillBySlug(params.slug);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  return NextResponse.json(skill);
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skill = getSkillBySlug(params.slug);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, description, icon_emoji, category, content } = body;

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
  }

  updateSkill(skill.id, {
    name: name?.trim(),
    description: description?.trim() || null,
    icon_emoji,
    category: category?.trim() || null,
    content: content?.trim(),
  });

  const updated = getSkillBySlug(params.slug);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skill = getSkillBySlug(params.slug);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  deleteSkill(skill.id);
  return NextResponse.json({ success: true });
}
