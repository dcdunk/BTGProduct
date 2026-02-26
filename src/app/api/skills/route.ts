import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllSkills, createSkill } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skills = getAllSkills();
  return NextResponse.json(skills);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { name, description, icon_emoji, category, content } = body;

  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Name and content are required' }, { status: 400 });
  }

  const skill = createSkill({
    name: name.trim(),
    description: description?.trim() || undefined,
    icon_emoji: icon_emoji || undefined,
    category: category?.trim() || undefined,
    content: content.trim(),
    created_by: userId,
  });

  return NextResponse.json(skill, { status: 201 });
}
