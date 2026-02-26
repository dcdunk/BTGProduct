import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAgentById,
  createAgent,
  getAgentSkills,
  getAgentTemplates,
  setAgentSkills,
  setAgentTemplates,
  duplicateAgentContextFiles,
} from '@/lib/db';
import type { Agent } from '@/types';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const source = getAgentById(params.id) as Agent | undefined;
  if (!source) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Create the duplicate agent
  const newAgent = createAgent({
    name: `${source.name} (Copy)`,
    description: source.description || undefined,
    avatar_emoji: source.avatar_emoji,
    system_prompt: source.system_prompt,
    provider: source.provider,
    model: source.model,
    temperature: source.temperature,
    created_by: userId,
  });

  // Copy context files
  duplicateAgentContextFiles(source.id, newAgent.id, userId);

  // Copy skill assignments
  const skills = getAgentSkills(source.id);
  if (skills.length > 0) {
    setAgentSkills(
      newAgent.id,
      skills.map(s => ({ skillId: s.id, mode: s.mode as 'always_on' | 'on_demand', sort_order: s.sort_order }))
    );
  }

  // Copy template assignments
  const templates = getAgentTemplates(source.id);
  if (templates.length > 0) {
    setAgentTemplates(
      newAgent.id,
      templates.map(t => ({ templateId: t.id, sort_order: t.sort_order }))
    );
  }

  return NextResponse.json(newAgent, { status: 201 });
}
