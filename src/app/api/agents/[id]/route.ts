import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentById, updateAgent, softDeleteAgent } from '@/lib/db';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(agent);
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

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { name, description, avatar_emoji, system_prompt } = body;

  updateAgent(params.id, {
    name: name?.trim(),
    description: description !== undefined ? (description?.trim() || null) : undefined,
    avatar_emoji,
    system_prompt: system_prompt?.trim(),
  });

  const updated = getAgentById(params.id);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  softDeleteAgent(params.id);
  return NextResponse.json({ success: true });
}
