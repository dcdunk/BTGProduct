import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

let dbPath: string;

function freshDbPath() {
  return path.join(os.tmpdir(), `mc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

async function loadDb() {
  vi.resetModules();
  dbPath = freshDbPath();
  process.env.DATABASE_PATH = dbPath;
  const mod = await import('../db');
  return mod;
}

afterEach(() => {
  try {
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  } catch { /* ignore */ }
});

describe('Agent lifecycle', () => {
  it('create -> update -> soft delete -> exclusion', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'Lifecycle Agent',
      system_prompt: 'Original prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    // Update name and system_prompt
    mod.updateAgent(agent.id, { name: 'Updated Agent', system_prompt: 'New prompt' });

    const updated = mod.getAgentById(agent.id) as { name: string; system_prompt: string };
    expect(updated).toBeDefined();
    expect(updated.name).toBe('Updated Agent');
    expect(updated.system_prompt).toBe('New prompt');

    // Soft delete
    mod.softDeleteAgent(agent.id);

    // getAllAgentsWithActivity should exclude it
    const allAgents = mod.getAllAgentsWithActivity() as { id: string }[];
    expect(allAgents.find(a => a.id === agent.id)).toBeUndefined();

    // getAgentById should return undefined for soft-deleted
    expect(mod.getAgentById(agent.id)).toBeUndefined();
  });

  it('duplicate context files from one agent to another', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);
    const db = mod.default();

    const agentA = mod.createAgent({
      name: 'Agent A',
      system_prompt: 'Prompt A',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    // Insert context files for agent A via direct SQL
    db.prepare(
      "INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)"
    ).run('file1.md', 'Content of file 1', agentA.id, user.id);
    db.prepare(
      "INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)"
    ).run('file2.md', 'Content of file 2', agentA.id, user.id);

    const agentB = mod.createAgent({
      name: 'Agent B',
      system_prompt: 'Prompt B',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    mod.duplicateAgentContextFiles(agentA.id, agentB.id, user.id);

    const copiedFiles = mod.getAgentContextFiles(agentB.id);
    expect(copiedFiles).toHaveLength(2);
    const names = copiedFiles.map(f => f.name).sort();
    expect(names).toEqual(['file1.md', 'file2.md']);
    expect(copiedFiles.find(f => f.name === 'file1.md')!.content).toBe('Content of file 1');
  });

  it('cascade deletes assignments when agent is hard-deleted', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);
    const db = mod.default();

    const agent = mod.createAgent({
      name: 'Cascade Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const skill = mod.createSkill({
      name: 'Cascade Skill',
      content: 'skill content',
      created_by: user.id,
    });

    const template = mod.createTemplate({
      name: 'Cascade Template',
      content: 'template content',
      created_by: user.id,
    });

    mod.setAgentSkills(agent.id, [{ skillId: skill.id, mode: 'always_on', sort_order: 0 }]);
    mod.setAgentTemplates(agent.id, [{ templateId: template.id, sort_order: 0 }]);

    // Verify assignments exist
    expect(mod.getAgentSkills(agent.id)).toHaveLength(1);
    expect(mod.getAgentTemplates(agent.id)).toHaveLength(1);

    // Hard delete
    db.prepare('DELETE FROM agents WHERE id = ?').run(agent.id);

    // Assignments should be cascaded
    expect(mod.getAgentSkills(agent.id)).toHaveLength(0);
    expect(mod.getAgentTemplates(agent.id)).toHaveLength(0);
  });
});

describe('Conversation lifecycle', () => {
  it('create with model -> messages -> title', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'Conv Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const conv = mod.createConversation(agent.id, user.id, 'openai', 'gpt-4o');

    // Add messages
    mod.createMessage({ conversationId: conv.id, role: 'user', content: 'Hello' });
    mod.createMessage({ conversationId: conv.id, role: 'assistant', content: 'Hi there!' });

    // Update title
    mod.updateConversationTitle(conv.id, 'Test Conversation');

    // Verify
    const fetched = mod.getConversationById(conv.id);
    expect(fetched).toBeDefined();
    expect(fetched!.provider).toBe('openai');
    expect(fetched!.model).toBe('gpt-4o');
    expect(fetched!.title).toBe('Test Conversation');

    const messages = mod.getMessagesByConversationId(conv.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hi there!');
  });

  it('update conversation model', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'Model Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const conv = mod.createConversation(agent.id, user.id, 'anthropic', 'claude-sonnet-4-20250514');
    mod.updateConversationModel(conv.id, 'openai', 'gpt-4o');

    const fetched = mod.getConversationById(conv.id);
    expect(fetched!.provider).toBe('openai');
    expect(fetched!.model).toBe('gpt-4o');
  });

  it('MCP servers -> delete conversation (servers not cascaded)', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'MCP Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const conv = mod.createConversation(agent.id, user.id);

    const s1 = mod.createMcpServer({
      name: 'Server One',
      transport_type: 'stdio',
      command: 'echo',
      created_by: user.id,
    });
    const s2 = mod.createMcpServer({
      name: 'Server Two',
      transport_type: 'stdio',
      command: 'echo',
      created_by: user.id,
    });

    mod.setConversationMcpServers(conv.id, [s1.id, s2.id]);
    expect(mod.getConversationMcpServers(conv.id)).toHaveLength(2);

    // Delete conversation
    mod.deleteConversation(conv.id);

    // MCP servers themselves should still exist
    expect(mod.getMcpServerById(s1.id)).toBeDefined();
    expect(mod.getMcpServerById(s2.id)).toBeDefined();
  });
});

describe('Skill/Template assignment', () => {
  it('assign -> verify -> reassign with fewer skills', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'Assign Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const skill1 = mod.createSkill({ name: 'Skill One', content: 'content 1', created_by: user.id });
    const skill2 = mod.createSkill({ name: 'Skill Two', content: 'content 2', created_by: user.id });

    mod.setAgentSkills(agent.id, [
      { skillId: skill1.id, mode: 'always_on', sort_order: 0 },
      { skillId: skill2.id, mode: 'on_demand', sort_order: 1 },
    ]);

    const skills = mod.getAgentSkills(agent.id);
    expect(skills).toHaveLength(2);
    expect(skills[0].mode).toBe('always_on');
    expect(skills[0].sort_order).toBe(0);
    expect(skills[1].mode).toBe('on_demand');
    expect(skills[1].sort_order).toBe(1);

    // Reassign with only skill2
    mod.setAgentSkills(agent.id, [
      { skillId: skill2.id, mode: 'always_on', sort_order: 0 },
    ]);

    const updated = mod.getAgentSkills(agent.id);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(skill2.id);
    expect(updated[0].mode).toBe('always_on');
  });

  it('assign templates -> set active on conversation', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const agent = mod.createAgent({
      name: 'Template Agent',
      system_prompt: 'prompt',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      created_by: user.id,
    });

    const template = mod.createTemplate({
      name: 'My Template',
      content: 'template content',
      created_by: user.id,
    });

    mod.setAgentTemplates(agent.id, [{ templateId: template.id, sort_order: 0 }]);
    expect(mod.getAgentTemplates(agent.id)).toHaveLength(1);

    const conv = mod.createConversation(agent.id, user.id);
    mod.setActiveTemplate(conv.id, template.id);

    const fetched = mod.getConversationById(conv.id);
    expect(fetched!.active_template_id).toBe(template.id);
  });
});

describe('API key lifecycle', () => {
  it('set -> resolve -> delete -> env fallback', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    mod.setApiKey('anthropic', 'sk-test-key-1234', user.id);
    expect(mod.getApiKeyForProvider('anthropic')).toBe('sk-test-key-1234');

    mod.deleteApiKey('anthropic');
    expect(mod.getApiKeyForProvider('anthropic')).toBeNull();

    // Set env fallback
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
    expect(mod.getApiKeyForProvider('anthropic')).toBe('sk-env-key');

    // Clean up
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('upsert same provider keeps only one entry', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    mod.setApiKey('openai', 'sk-first-key', user.id);
    mod.setApiKey('openai', 'sk-second-key', user.id);

    const statuses = mod.getAllApiKeyStatuses();
    const openaiStatuses = statuses.filter(s => s.provider === 'openai');
    expect(openaiStatuses).toHaveLength(1);

    expect(mod.getApiKeyForProvider('openai')).toBe('sk-second-key');
  });
});

describe('Scratchpad lifecycle', () => {
  it('create -> update -> verify', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const item = mod.createScratchpadItem({
      title: 'Original Title',
      content: 'Original content',
      createdBy: user.id,
    });

    mod.updateScratchpadItem(item.id, { title: 'Updated Title', content: 'Updated content' });

    const fetched = mod.getScratchpadItemById(item.id);
    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Updated Title');
    expect(fetched!.content).toBe('Updated content');
  });

  it('multi-item -> delete one -> verify count', async () => {
    const mod = await loadDb();
    const user = mod.getOrCreateUser('test@test.com', 'Test User', null);

    const item1 = mod.createScratchpadItem({ title: 'Item 1', content: 'c1', createdBy: user.id });
    mod.createScratchpadItem({ title: 'Item 2', content: 'c2', createdBy: user.id });
    mod.createScratchpadItem({ title: 'Item 3', content: 'c3', createdBy: user.id });

    expect(mod.getScratchpadItems(user.id)).toHaveLength(3);

    mod.deleteScratchpadItem(item1.id);

    expect(mod.getScratchpadItems(user.id)).toHaveLength(2);
  });
});
