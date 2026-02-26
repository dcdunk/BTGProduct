import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeAgent } from './helpers';

vi.mock('@/lib/db', () => ({
  getWorkspaceContextFiles: vi.fn(),
  getAgentContextFiles: vi.fn(),
  getAlwaysOnSkills: vi.fn(),
  getTemplateById: vi.fn(),
  getSkillBySlugForAgent: vi.fn(),
}));

import {
  getWorkspaceContextFiles,
  getAgentContextFiles,
  getAlwaysOnSkills,
  getTemplateById,
  getSkillBySlugForAgent,
} from '@/lib/db';
import { assembleSystemPrompt, parseSkillCommand } from '../llm/system-prompt';

const mockGetWorkspaceContextFiles = vi.mocked(getWorkspaceContextFiles);
const mockGetAgentContextFiles = vi.mocked(getAgentContextFiles);
const mockGetAlwaysOnSkills = vi.mocked(getAlwaysOnSkills);
const mockGetTemplateById = vi.mocked(getTemplateById);
const mockGetSkillBySlugForAgent = vi.mocked(getSkillBySlugForAgent);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWorkspaceContextFiles.mockReturnValue([]);
  mockGetAgentContextFiles.mockReturnValue([]);
  mockGetAlwaysOnSkills.mockReturnValue([]);
  mockGetTemplateById.mockReturnValue(undefined as never);
  mockGetSkillBySlugForAgent.mockReturnValue(undefined as never);
});

describe('assembleSystemPrompt', () => {
  it('includes workspace context files with header formatting', () => {
    mockGetWorkspaceContextFiles.mockReturnValue([
      { id: 'cf-1', name: 'Brand Guide', content: 'Be on brand.', scope: 'workspace', agent_id: null, created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).toContain('--- Context: Brand Guide ---\nBe on brand.');
  });

  it('includes agent context files with header formatting', () => {
    mockGetAgentContextFiles.mockReturnValue([
      { id: 'cf-2', name: 'Agent Docs', content: 'Agent-specific info.', scope: 'agent', agent_id: 'agent-1', created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).toContain('--- Context: Agent Docs ---\nAgent-specific info.');
  });

  it('includes agent system_prompt', () => {
    const result = assembleSystemPrompt({
      agent: makeAgent({ system_prompt: 'You are a PRD writer.' }),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).toContain('You are a PRD writer.');
  });

  it('includes always-on skills with header formatting', () => {
    mockGetAlwaysOnSkills.mockReturnValue([
      { id: 's-1', name: 'Formatting', slug: 'formatting', description: null, icon_emoji: '📝', content: 'Use markdown.', category: null, created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).toContain('--- Skill: Formatting ---\nUse markdown.');
  });

  it('includes active template when activeTemplateId is set', () => {
    mockGetTemplateById.mockReturnValue({
      id: 't-1', name: 'PRD Template', slug: 'prd', description: null, icon_emoji: '📄',
      format: 'markdown', content: '# PRD\n## Overview', category: null,
      created_by: 'u1', created_at: '', updated_at: '',
    });
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: 't-1',
      onDemandSkillSlug: null,
    });
    expect(result).toContain('--- Active Template: PRD Template ---');
    expect(result).toContain('Structure your response according to this template:');
    expect(result).toContain('# PRD\n## Overview');
  });

  it('omits template when activeTemplateId is null', () => {
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).not.toContain('--- Active Template:');
    expect(mockGetTemplateById).not.toHaveBeenCalled();
  });

  it('omits template when template not found', () => {
    mockGetTemplateById.mockReturnValue(undefined as never);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: 'nonexistent',
      onDemandSkillSlug: null,
    });
    expect(result).not.toContain('--- Active Template:');
  });

  it('includes on-demand skill when slug is set', () => {
    mockGetSkillBySlugForAgent.mockReturnValue({
      id: 's-2', name: 'Competitor Analysis', slug: 'competitor', description: null,
      icon_emoji: '🔍', content: 'Analyze competitors.', category: null,
      created_by: 'u1', created_at: '', updated_at: '',
    });
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: 'competitor',
    });
    expect(result).toContain('--- On-Demand Skill: Competitor Analysis ---\nAnalyze competitors.');
  });

  it('omits on-demand skill when slug is null', () => {
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).not.toContain('--- On-Demand Skill:');
    expect(mockGetSkillBySlugForAgent).not.toHaveBeenCalled();
  });

  it('omits on-demand skill when not found for agent', () => {
    mockGetSkillBySlugForAgent.mockReturnValue(undefined as never);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: 'missing-skill',
    });
    expect(result).not.toContain('--- On-Demand Skill:');
  });

  it('assembles all parts in correct order', () => {
    mockGetWorkspaceContextFiles.mockReturnValue([
      { id: 'cf-1', name: 'WS Context', content: 'workspace content', scope: 'workspace', agent_id: null, created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    mockGetAgentContextFiles.mockReturnValue([
      { id: 'cf-2', name: 'Agent Context', content: 'agent content', scope: 'agent', agent_id: 'agent-1', created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    mockGetAlwaysOnSkills.mockReturnValue([
      { id: 's-1', name: 'AlwaysSkill', slug: 'always', description: null, icon_emoji: '⚡', content: 'always skill content', category: null, created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    mockGetTemplateById.mockReturnValue({
      id: 't-1', name: 'Template', slug: 'tmpl', description: null, icon_emoji: '📄',
      format: 'markdown', content: 'template content', category: null,
      created_by: 'u1', created_at: '', updated_at: '',
    });
    mockGetSkillBySlugForAgent.mockReturnValue({
      id: 's-2', name: 'OnDemand', slug: 'ondemand', description: null,
      icon_emoji: '🔧', content: 'ondemand content', category: null,
      created_by: 'u1', created_at: '', updated_at: '',
    });

    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: 't-1',
      onDemandSkillSlug: 'ondemand',
    });

    const wsIdx = result.indexOf('--- Context: WS Context ---');
    const agentCtxIdx = result.indexOf('--- Context: Agent Context ---');
    const sysPromptIdx = result.indexOf('You are a test agent.');
    const skillIdx = result.indexOf('--- Skill: AlwaysSkill ---');
    const templateIdx = result.indexOf('--- Active Template: Template ---');
    const onDemandIdx = result.indexOf('--- On-Demand Skill: OnDemand ---');

    expect(wsIdx).toBeLessThan(agentCtxIdx);
    expect(agentCtxIdx).toBeLessThan(sysPromptIdx);
    expect(sysPromptIdx).toBeLessThan(skillIdx);
    expect(skillIdx).toBeLessThan(templateIdx);
    expect(templateIdx).toBeLessThan(onDemandIdx);
  });

  it('separates parts with double newlines', () => {
    mockGetWorkspaceContextFiles.mockReturnValue([
      { id: 'cf-1', name: 'WS', content: 'ws stuff', scope: 'workspace', agent_id: null, created_by: 'u1', created_at: '', updated_at: '' },
    ]);
    const result = assembleSystemPrompt({
      agent: makeAgent(),
      activeTemplateId: null,
      onDemandSkillSlug: null,
    });
    expect(result).toContain('ws stuff\n\nYou are a test agent.');
  });
});

describe('parseSkillCommand', () => {
  it('extracts slug and remaining content from /skill slug message text', () => {
    const result = parseSkillCommand('/skill competitor Analyze Acme Corp');
    expect(result.skillSlug).toBe('competitor');
    expect(result.cleanContent).toBe('Analyze Acme Corp');
  });

  it('returns null skillSlug for messages without /skill prefix', () => {
    const result = parseSkillCommand('Just a normal message');
    expect(result.skillSlug).toBeNull();
    expect(result.cleanContent).toBe('Just a normal message');
  });

  it('returns original content when /skill has no message after slug', () => {
    const result = parseSkillCommand('/skill competitor');
    expect(result.skillSlug).toBe('competitor');
    expect(result.cleanContent).toBe('/skill competitor');
  });

  it('handles extra whitespace', () => {
    const result = parseSkillCommand('/skill   competitor   Do the thing  ');
    expect(result.skillSlug).toBe('competitor');
    expect(result.cleanContent).toBe('Do the thing');
  });

  it('does not match /skill in middle of message', () => {
    const result = parseSkillCommand('Please run /skill competitor now');
    expect(result.skillSlug).toBeNull();
    expect(result.cleanContent).toBe('Please run /skill competitor now');
  });

  it('extracts only first word as slug', () => {
    const result = parseSkillCommand('/skill multi-word-slug rest of message');
    expect(result.skillSlug).toBe('multi-word-slug');
    expect(result.cleanContent).toBe('rest of message');
  });
});
