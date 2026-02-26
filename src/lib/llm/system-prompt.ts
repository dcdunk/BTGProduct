import 'server-only';
import {
  getWorkspaceContextFiles,
  getAgentContextFiles,
  getAlwaysOnSkills,
  getTemplateById,
  getSkillBySlugForAgent,
} from '@/lib/db';
import type { Agent } from '@/types';

interface AssembleOptions {
  agent: Agent;
  activeTemplateId: string | null;
  onDemandSkillSlug: string | null;
}

export function assembleSystemPrompt(options: AssembleOptions): string {
  const parts: string[] = [];

  // 1. Workspace context files
  const workspaceFiles = getWorkspaceContextFiles();
  for (const cf of workspaceFiles) {
    parts.push(`--- Context: ${cf.name} ---\n${cf.content}`);
  }

  // 2. Agent-specific context files
  const agentFiles = getAgentContextFiles(options.agent.id);
  for (const cf of agentFiles) {
    parts.push(`--- Context: ${cf.name} ---\n${cf.content}`);
  }

  // 3. Agent system prompt
  parts.push(options.agent.system_prompt);

  // 4. Always-on skills (ordered by sort_order)
  const skills = getAlwaysOnSkills(options.agent.id);
  for (const skill of skills) {
    parts.push(`--- Skill: ${skill.name} ---\n${skill.content}`);
  }

  // 5. Active template (if set on conversation)
  if (options.activeTemplateId) {
    const template = getTemplateById(options.activeTemplateId);
    if (template) {
      parts.push(`--- Active Template: ${template.name} ---\nStructure your response according to this template:\n\n${template.content}`);
    }
  }

  // 6. On-demand skill (single turn)
  if (options.onDemandSkillSlug) {
    const skill = getSkillBySlugForAgent(options.agent.id, options.onDemandSkillSlug);
    if (skill) {
      parts.push(`--- On-Demand Skill: ${skill.name} ---\n${skill.content}`);
    }
  }

  return parts.join('\n\n');
}

export function parseSkillCommand(content: string): {
  cleanContent: string;
  skillSlug: string | null;
} {
  const match = content.match(/^\/skill\s+(\S+)\s*/);
  if (!match) return { cleanContent: content, skillSlug: null };
  const cleaned = content.slice(match[0].length).trim();
  return {
    cleanContent: cleaned || content,
    skillSlug: match[1],
  };
}
