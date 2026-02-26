import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentById, getAgentSkills, setAgentSkills } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const skills = getAgentSkills(params.id);
  return NextResponse.json(skills);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agent = getAgentById(params.id);
  if (!agent) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { assignments } = await request.json();
  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
  }

  setAgentSkills(params.id, assignments);
  const updated = getAgentSkills(params.id);
  return NextResponse.json(updated);
}
