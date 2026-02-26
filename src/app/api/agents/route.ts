import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllAgentsWithActivity, createAgent } from '@/lib/db';
import { DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_TEMPERATURE } from '@/types';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = getAllAgentsWithActivity();
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const body = await request.json();
  const { name, description, avatar_emoji, system_prompt } = body;

  if (!name?.trim() || !system_prompt?.trim()) {
    return NextResponse.json({ error: 'Name and system prompt are required' }, { status: 400 });
  }

  const agent = createAgent({
    name: name.trim(),
    description: description?.trim() || undefined,
    avatar_emoji: avatar_emoji || undefined,
    system_prompt: system_prompt.trim(),
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    created_by: userId,
  });

  return NextResponse.json(agent, { status: 201 });
}
