import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Each test gets a fresh DB by resetting module state
let dbPath: string;

function freshDbPath() {
  return path.join(os.tmpdir(), `mc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

async function loadDb() {
  // Reset module cache to get a fresh DB instance
  vi.resetModules();
  dbPath = freshDbPath();
  process.env.DATABASE_PATH = dbPath;

  const mod = await import('../db');
  return mod;
}

describe('database', () => {
  afterEach(() => {
    // Clean up temp DB files
    try {
      if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
      if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
    } catch {
      // ignore cleanup errors
    }
  });

  describe('schema', () => {
    it('creates all 18 tables', async () => {
      const { default: getDb } = await loadDb();
      const db = getDb();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name).sort();
      expect(tableNames).toEqual([
        'agent_mcp_servers',
        'agent_skills',
        'agent_templates',
        'agents',
        'api_keys',
        'context_files',
        'conversation_mcp_servers',
        'conversations',
        'mcp_oauth_clients',
        'mcp_oauth_state',
        'mcp_oauth_tokens',
        'mcp_servers',
        'messages',
        'scratchpad',
        'skills',
        'templates',
        'user_google_tokens',
        'users',
      ]);
    });
  });

  describe('getOrCreateUser', () => {
    it('assigns admin role to the first user', async () => {
      const { getOrCreateUser } = await loadDb();
      const user = getOrCreateUser('admin@test.com', 'Admin', null);
      expect(user.role).toBe('admin');
      expect(user.email).toBe('admin@test.com');
    });

    it('assigns member role to subsequent users', async () => {
      const { getOrCreateUser } = await loadDb();
      getOrCreateUser('first@test.com', 'First', null);
      const second = getOrCreateUser('second@test.com', 'Second', null);
      expect(second.role).toBe('member');
    });

    it('returns existing user on repeat call and updates name/avatar', async () => {
      const { getOrCreateUser } = await loadDb();
      const first = getOrCreateUser('user@test.com', 'Original Name', null);
      const second = getOrCreateUser('user@test.com', 'Updated Name', 'https://avatar.url');
      expect(second.id).toBe(first.id);
      expect(second.role).toBe('admin'); // role unchanged
    });
  });

  describe('getUserByEmail / getUserById', () => {
    it('returns user by email', async () => {
      const { getOrCreateUser, getUserByEmail } = await loadDb();
      getOrCreateUser('find@test.com', 'Find Me', null);
      const found = getUserByEmail('find@test.com');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Me');
    });

    it('returns undefined for missing email', async () => {
      const { getUserByEmail } = await loadDb();
      expect(getUserByEmail('nope@test.com')).toBeUndefined();
    });

    it('returns user by id', async () => {
      const { getOrCreateUser, getUserById } = await loadDb();
      const user = getOrCreateUser('byid@test.com', 'By ID', null);
      const found = getUserById(user.id);
      expect(found).toBeDefined();
      expect(found!.email).toBe('byid@test.com');
    });

    it('returns undefined for missing id', async () => {
      const { getUserById } = await loadDb();
      expect(getUserById('nonexistent')).toBeUndefined();
    });
  });

  describe('generateSlug', () => {
    it('lowercases and strips special chars, replaces spaces with hyphens', async () => {
      const { generateSlug } = await loadDb();
      expect(generateSlug('Hello World!', 'agents')).toBe('hello-world');
    });

    it('appends counter on collision', async () => {
      const { generateSlug, getOrCreateUser } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('slug@test.com', 'Slug Tester', null);

      // Insert an agent with slug "test-agent"
      db.prepare(
        "INSERT INTO agents (name, slug, description, system_prompt, provider, model, created_by) VALUES (?, ?, '', '', 'anthropic', 'claude-sonnet-4-20250514', ?)"
      ).run('Test Agent', 'test-agent', user.id);

      const slug2 = generateSlug('Test Agent', 'agents');
      expect(slug2).toBe('test-agent-2');

      // Insert that too, then check -3
      db.prepare(
        "INSERT INTO agents (name, slug, description, system_prompt, provider, model, created_by) VALUES (?, ?, '', '', 'anthropic', 'claude-sonnet-4-20250514', ?)"
      ).run('Test Agent 2', 'test-agent-2', user.id);

      const slug3 = generateSlug('Test Agent', 'agents');
      expect(slug3).toBe('test-agent-3');
    });

    it('truncates to 60 chars', async () => {
      const { generateSlug } = await loadDb();
      const longName = 'a'.repeat(100);
      const slug = generateSlug(longName, 'agents');
      expect(slug.length).toBeLessThanOrEqual(60);
    });
  });

  describe('getAllAgentsWithActivity', () => {
    it('excludes soft-deleted agents', async () => {
      const { getOrCreateUser, getAllAgentsWithActivity } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('act@test.com', 'Activity Tester', null);

      db.prepare(
        "INSERT INTO agents (name, slug, description, system_prompt, provider, model, created_by) VALUES (?, ?, '', '', 'anthropic', 'claude-sonnet-4-20250514', ?)"
      ).run('Active Agent', 'active-agent', user.id);

      db.prepare(
        "INSERT INTO agents (name, slug, description, system_prompt, provider, model, created_by, deleted_at) VALUES (?, ?, '', '', 'anthropic', 'claude-sonnet-4-20250514', ?, CURRENT_TIMESTAMP)"
      ).run('Deleted Agent', 'deleted-agent', user.id);

      const agents = getAllAgentsWithActivity() as { name: string }[];
      const names = agents.map((a) => a.name);
      expect(names).toContain('Active Agent');
      expect(names).not.toContain('Deleted Agent');
    });

    it('includes last_active and conversation_count fields', async () => {
      const { getOrCreateUser, getAllAgentsWithActivity } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('fields@test.com', 'Field Tester', null);

      db.prepare(
        "INSERT INTO agents (name, slug, description, system_prompt, provider, model, created_by) VALUES (?, ?, '', '', 'anthropic', 'claude-sonnet-4-20250514', ?)"
      ).run('Field Agent', 'field-agent', user.id);

      const agents = getAllAgentsWithActivity() as Record<string, unknown>[];
      const agent = agents.find((a) => a.name === 'Field Agent');
      expect(agent).toBeDefined();
      expect('last_active' in agent!).toBe(true);
      expect('conversation_count' in agent!).toBe(true);
    });
  });

  // ============================================
  // Agent CRUD
  // ============================================

  describe('Agent CRUD', () => {
    it('createAgent returns agent with generated slug', async () => {
      const { getOrCreateUser, createAgent } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'My Test Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      expect(agent.id).toBeDefined();
      expect(agent.slug).toBe('my-test-agent');
      expect(agent.name).toBe('My Test Agent');
    });

    it('createAgent applies default values (emoji, temperature, is_shared)', async () => {
      const { getOrCreateUser, createAgent } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Defaults Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      expect(agent.avatar_emoji).toBe('\u{1F916}');
      expect(agent.temperature).toBe(0.7);
      expect(agent.is_shared).toBe(1);
    });

    it('getAgentById returns the created agent', async () => {
      const { getOrCreateUser, createAgent, getAgentById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Find Me', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const found = getAgentById(agent.id);
      expect(found).toBeDefined();
      expect((found as { name: string }).name).toBe('Find Me');
    });

    it('getAgentById returns undefined for nonexistent id', async () => {
      const { getAgentById } = await loadDb();
      const found = getAgentById('nonexistent-id');
      expect(found).toBeUndefined();
    });

    it('getAgentById excludes soft-deleted agents', async () => {
      const { getOrCreateUser, createAgent, softDeleteAgent, getAgentById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Delete Me', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      softDeleteAgent(agent.id);
      const found = getAgentById(agent.id);
      expect(found).toBeUndefined();
    });

    it('getAgentBySlug returns the created agent', async () => {
      const { getOrCreateUser, createAgent, getAgentBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createAgent({ name: 'Slug Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const found = getAgentBySlug('slug-agent');
      expect(found).toBeDefined();
      expect((found as { name: string }).name).toBe('Slug Agent');
    });

    it('getAgentBySlug returns undefined for nonexistent slug', async () => {
      const { getAgentBySlug } = await loadDb();
      const found = getAgentBySlug('does-not-exist');
      expect(found).toBeUndefined();
    });

    it('getAgentBySlug excludes soft-deleted agents', async () => {
      const { getOrCreateUser, createAgent, softDeleteAgent, getAgentBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Soft Delete Slug', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      softDeleteAgent(agent.id);
      const found = getAgentBySlug(agent.slug);
      expect(found).toBeUndefined();
    });

    it('updateAgent modifies specified fields only', async () => {
      const { getOrCreateUser, createAgent, updateAgent, getAgentById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Original', system_prompt: 'original prompt', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      updateAgent(agent.id, { name: 'Updated' });
      const found = getAgentById(agent.id) as { name: string; system_prompt: string };
      expect(found.name).toBe('Updated');
      expect(found.system_prompt).toBe('original prompt');
    });

    it('updateAgent with empty data is a no-op', async () => {
      const { getOrCreateUser, createAgent, updateAgent, getAgentById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'NoOp', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      updateAgent(agent.id, {});
      const found = getAgentById(agent.id) as { name: string };
      expect(found.name).toBe('NoOp');
    });

    it('softDeleteAgent sets deleted_at', async () => {
      const { getOrCreateUser, createAgent, softDeleteAgent } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'To Delete', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      softDeleteAgent(agent.id);
      const row = db.prepare('SELECT deleted_at FROM agents WHERE id = ?').get(agent.id) as { deleted_at: string | null };
      expect(row.deleted_at).not.toBeNull();
    });

    it('duplicateAgentContextFiles copies all context files to target agent', async () => {
      const { getOrCreateUser, createAgent, duplicateAgentContextFiles, getAgentContextFiles } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const source = createAgent({ name: 'Source', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const target = createAgent({ name: 'Target', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });

      // Insert context files for source agent
      db.prepare("INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)").run('file1.md', 'content1', source.id, user.id);
      db.prepare("INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)").run('file2.md', 'content2', source.id, user.id);

      duplicateAgentContextFiles(source.id, target.id, user.id);

      const targetFiles = getAgentContextFiles(target.id);
      expect(targetFiles).toHaveLength(2);
      expect(targetFiles.map(f => f.name).sort()).toEqual(['file1.md', 'file2.md']);
      expect(targetFiles.map(f => f.content).sort()).toEqual(['content1', 'content2']);
    });
  });

  // ============================================
  // Conversation CRUD
  // ============================================

  describe('Conversation CRUD', () => {
    it('createConversation returns conversation with correct agent_id and user_id', async () => {
      const { getOrCreateUser, createAgent, createConversation } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      expect(conv.id).toBeDefined();
      expect(conv.agent_id).toBe(agent.id);
      expect(conv.user_id).toBe(user.id);
    });

    it('createConversation stores provider and model when provided', async () => {
      const { getOrCreateUser, createAgent, createConversation } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Conv Agent PM', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id, 'openai', 'gpt-4o');
      expect(conv.provider).toBe('openai');
      expect(conv.model).toBe('gpt-4o');
    });

    it('createConversation defaults provider/model to null when omitted', async () => {
      const { getOrCreateUser, createAgent, createConversation } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Conv Agent Null', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      expect(conv.provider).toBeNull();
      expect(conv.model).toBeNull();
    });

    it('getConversationById returns created conversation', async () => {
      const { getOrCreateUser, createAgent, createConversation, getConversationById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Conv Agent Get', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const found = getConversationById(conv.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(conv.id);
    });

    it('getConversationById returns undefined for nonexistent id', async () => {
      const { getConversationById } = await loadDb();
      expect(getConversationById('nonexistent')).toBeUndefined();
    });

    it('getConversationsByAgentId returns conversations for user ordered by updated_at DESC', async () => {
      const { getOrCreateUser, createAgent, createConversation, getConversationsByAgentId, updateConversationTitle } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Conv List Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv1 = createConversation(agent.id, user.id);
      const conv2 = createConversation(agent.id, user.id);
      // Touch conv1 to make it more recent
      updateConversationTitle(conv1.id, 'First');
      const convs = getConversationsByAgentId(agent.id, user.id);
      expect(convs).toHaveLength(2);
      // conv1 was updated more recently
      expect(convs[0].id).toBe(conv1.id);
    });

    it('getConversationsByAgentId returns empty array when none exist', async () => {
      const { getOrCreateUser, createAgent, getConversationsByAgentId } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Empty Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const convs = getConversationsByAgentId(agent.id, user.id);
      expect(convs).toEqual([]);
    });

    it('updateConversationTitle changes the title', async () => {
      const { getOrCreateUser, createAgent, createConversation, updateConversationTitle, getConversationById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Title Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      updateConversationTitle(conv.id, 'New Title');
      const found = getConversationById(conv.id);
      expect(found!.title).toBe('New Title');
    });

    it('touchConversation updates updated_at', async () => {
      const { getOrCreateUser, createAgent, createConversation, touchConversation, getConversationById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Touch Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const originalUpdatedAt = conv.updated_at;
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 50));
      touchConversation(conv.id);
      const found = getConversationById(conv.id);
      // updated_at should be changed (or at least not before original)
      expect(found!.updated_at).toBeDefined();
    });

    it('setActiveTemplate sets and clears template', async () => {
      const { getOrCreateUser, createAgent, createConversation, setActiveTemplate, getConversationById, createTemplate } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Template Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const template = createTemplate({ name: 'Test Template', content: 'template content', created_by: user.id });
      const conv = createConversation(agent.id, user.id);

      setActiveTemplate(conv.id, template.id);
      let found = getConversationById(conv.id);
      expect(found!.active_template_id).toBe(template.id);

      setActiveTemplate(conv.id, null);
      found = getConversationById(conv.id);
      expect(found!.active_template_id).toBeNull();
    });

    it('deleteConversation removes conversation, messages, and conversation_mcp_servers', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage, deleteConversation, getConversationById, getMessagesByConversationId, createMcpServer, setConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Delete Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      createMessage({ conversationId: conv.id, role: 'user', content: 'hello' });
      const server = createMcpServer({ name: 'Test Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setConversationMcpServers(conv.id, [server.id]);

      deleteConversation(conv.id);
      expect(getConversationById(conv.id)).toBeUndefined();
      expect(getMessagesByConversationId(conv.id)).toEqual([]);
    });

    it('updateConversationModel changes provider and model', async () => {
      const { getOrCreateUser, createAgent, createConversation, updateConversationModel, getConversationById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Model Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      updateConversationModel(conv.id, 'openai', 'gpt-4o');
      const found = getConversationById(conv.id);
      expect(found!.provider).toBe('openai');
      expect(found!.model).toBe('gpt-4o');
    });

    it('getConversationMcpServers returns servers linked to conversation', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMcpServer, setConversationMcpServers, getConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'MCP Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const server = createMcpServer({ name: 'Conv Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setConversationMcpServers(conv.id, [server.id]);
      const servers = getConversationMcpServers(conv.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Conv Server');
    });

    it('setConversationMcpServers replaces all server associations', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMcpServer, setConversationMcpServers, getConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Replace Conv Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const server1 = createMcpServer({ name: 'Server 1', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const server2 = createMcpServer({ name: 'Server 2', transport_type: 'stdio', command: 'echo', created_by: user.id });

      setConversationMcpServers(conv.id, [server1.id]);
      expect(getConversationMcpServers(conv.id)).toHaveLength(1);

      setConversationMcpServers(conv.id, [server2.id]);
      const servers = getConversationMcpServers(conv.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Server 2');
    });
  });

  // ============================================
  // Conversation MCP Servers
  // ============================================

  describe('Conversation MCP Servers', () => {
    it('getConversationMcpServers returns empty array when none assigned', async () => {
      const { getOrCreateUser, createAgent, createConversation, getConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'No MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      expect(getConversationMcpServers(conv.id)).toEqual([]);
    });

    it('setConversationMcpServers assigns servers to conversation', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMcpServer, setConversationMcpServers, getConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Assign MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const server = createMcpServer({ name: 'Assign Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setConversationMcpServers(conv.id, [server.id]);
      const servers = getConversationMcpServers(conv.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(server.id);
    });

    it('setConversationMcpServers replaces previous assignments', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMcpServer, setConversationMcpServers, getConversationMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Replace MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const s1 = createMcpServer({ name: 'S1', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const s2 = createMcpServer({ name: 'S2', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setConversationMcpServers(conv.id, [s1.id]);
      setConversationMcpServers(conv.id, [s2.id]);
      const servers = getConversationMcpServers(conv.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(s2.id);
    });

    it('getConversationMcpServers excludes inactive servers', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMcpServer, setConversationMcpServers, getConversationMcpServers, updateMcpServer } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Inactive MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const server = createMcpServer({ name: 'Inactive Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setConversationMcpServers(conv.id, [server.id]);
      updateMcpServer(server.id, { is_active: 0 });
      expect(getConversationMcpServers(conv.id)).toEqual([]);
    });

    it('getActiveMcpServers returns only active servers', async () => {
      const { getOrCreateUser, createMcpServer, updateMcpServer, getActiveMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const s1 = createMcpServer({ name: 'Active', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const s2 = createMcpServer({ name: 'Inactive', transport_type: 'stdio', command: 'echo', created_by: user.id });
      updateMcpServer(s2.id, { is_active: 0 });
      const active = getActiveMcpServers();
      expect(active.map(s => s.id)).toContain(s1.id);
      expect(active.map(s => s.id)).not.toContain(s2.id);
    });
  });

  // ============================================
  // Messages
  // ============================================

  describe('Messages', () => {
    it('createMessage inserts a user message', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Msg Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const msg = createMessage({ conversationId: conv.id, role: 'user', content: 'hello world' });
      expect(msg.id).toBeDefined();
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('hello world');
      expect(msg.conversation_id).toBe(conv.id);
    });

    it('createMessage inserts assistant message with token counts', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Token Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const msg = createMessage({
        conversationId: conv.id,
        role: 'assistant',
        content: 'response',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        tokens_in: 100,
        tokens_out: 200,
      });
      expect(msg.role).toBe('assistant');
      expect(msg.provider).toBe('anthropic');
      expect(msg.tokens_in).toBe(100);
      expect(msg.tokens_out).toBe(200);
    });

    it('getMessagesByConversationId returns messages in ASC order', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage, getMessagesByConversationId } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Order Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      createMessage({ conversationId: conv.id, role: 'user', content: 'first' });
      createMessage({ conversationId: conv.id, role: 'assistant', content: 'second' });
      createMessage({ conversationId: conv.id, role: 'user', content: 'third' });
      const msgs = getMessagesByConversationId(conv.id);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].content).toBe('first');
      expect(msgs[1].content).toBe('second');
      expect(msgs[2].content).toBe('third');
    });

    it('getMessagesByConversationId returns empty array for empty conversation', async () => {
      const { getOrCreateUser, createAgent, createConversation, getMessagesByConversationId } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Empty Msg Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      expect(getMessagesByConversationId(conv.id)).toEqual([]);
    });

    it('searchMessages finds messages by content substring', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage, searchMessages } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Search Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      createMessage({ conversationId: conv.id, role: 'user', content: 'the quick brown fox' });
      createMessage({ conversationId: conv.id, role: 'assistant', content: 'lazy dog' });

      const results = searchMessages(user.id, 'brown fox');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('brown fox');
    });

    it('searchMessages filters by agentId when provided', async () => {
      const { getOrCreateUser, createAgent, createConversation, createMessage, searchMessages } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent1 = createAgent({ name: 'Search Agent 1', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const agent2 = createAgent({ name: 'Search Agent 2', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv1 = createConversation(agent1.id, user.id);
      const conv2 = createConversation(agent2.id, user.id);
      createMessage({ conversationId: conv1.id, role: 'user', content: 'unique keyword alpha' });
      createMessage({ conversationId: conv2.id, role: 'user', content: 'unique keyword beta' });

      const results = searchMessages(user.id, 'unique keyword', agent1.id);
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('alpha');
    });
  });

  // ============================================
  // Skills CRUD
  // ============================================

  describe('Skills CRUD', () => {
    it('createSkill returns skill with generated slug', async () => {
      const { getOrCreateUser, createSkill } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const skill = createSkill({ name: 'My Skill', content: 'skill content', created_by: user.id });
      expect(skill.id).toBeDefined();
      expect(skill.slug).toBe('my-skill');
      expect(skill.name).toBe('My Skill');
    });

    it('createSkill applies defaults', async () => {
      const { getOrCreateUser, createSkill } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const skill = createSkill({ name: 'Default Skill', content: 'content', created_by: user.id });
      expect(skill.icon_emoji).toBe('\u{1F527}');
      expect(skill.description).toBeNull();
      expect(skill.category).toBeNull();
    });

    it('getSkillBySlug returns created skill', async () => {
      const { getOrCreateUser, createSkill, getSkillBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createSkill({ name: 'Find Skill', content: 'content', created_by: user.id });
      const found = getSkillBySlug('find-skill');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Skill');
    });

    it('getSkillBySlug returns undefined for nonexistent', async () => {
      const { getSkillBySlug } = await loadDb();
      expect(getSkillBySlug('nonexistent')).toBeUndefined();
    });

    it('getAllSkills returns skills with agent_count', async () => {
      const { getOrCreateUser, createSkill, getAllSkills } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createSkill({ name: 'Count Skill', content: 'content', created_by: user.id });
      const skills = getAllSkills();
      expect(skills.length).toBeGreaterThanOrEqual(1);
      const found = skills.find(s => s.name === 'Count Skill');
      expect(found).toBeDefined();
      expect(found!.agent_count).toBe(0);
    });

    it('updateSkill modifies specified fields', async () => {
      const { getOrCreateUser, createSkill, updateSkill, getSkillBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const skill = createSkill({ name: 'Update Skill', content: 'original', created_by: user.id });
      updateSkill(skill.id, { content: 'updated content' });
      const found = getSkillBySlug(skill.slug);
      expect(found!.content).toBe('updated content');
      expect(found!.name).toBe('Update Skill');
    });

    it('updateSkill with empty data is no-op', async () => {
      const { getOrCreateUser, createSkill, updateSkill, getSkillBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const skill = createSkill({ name: 'NoOp Skill', content: 'content', created_by: user.id });
      updateSkill(skill.id, {});
      const found = getSkillBySlug(skill.slug);
      expect(found!.name).toBe('NoOp Skill');
    });

    it('deleteSkill removes the skill', async () => {
      const { getOrCreateUser, createSkill, deleteSkill, getSkillBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const skill = createSkill({ name: 'Delete Skill', content: 'content', created_by: user.id });
      deleteSkill(skill.id);
      expect(getSkillBySlug(skill.slug)).toBeUndefined();
    });

    it('setAgentSkills assigns skills with mode and sort_order', async () => {
      const { getOrCreateUser, createAgent, createSkill, setAgentSkills, getAgentSkills } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Skill Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const skill = createSkill({ name: 'Assigned Skill', content: 'content', created_by: user.id });
      setAgentSkills(agent.id, [{ skillId: skill.id, mode: 'always_on', sort_order: 1 }]);
      const skills = getAgentSkills(agent.id);
      expect(skills).toHaveLength(1);
      expect(skills[0].mode).toBe('always_on');
      expect(skills[0].sort_order).toBe(1);
    });

    it('getAgentSkills returns assigned skills ordered by sort_order', async () => {
      const { getOrCreateUser, createAgent, createSkill, setAgentSkills, getAgentSkills } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Ordered Skill Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const s1 = createSkill({ name: 'Skill A', content: 'a', created_by: user.id });
      const s2 = createSkill({ name: 'Skill B', content: 'b', created_by: user.id });
      setAgentSkills(agent.id, [
        { skillId: s2.id, mode: 'on_demand', sort_order: 2 },
        { skillId: s1.id, mode: 'always_on', sort_order: 1 },
      ]);
      const skills = getAgentSkills(agent.id);
      expect(skills).toHaveLength(2);
      expect(skills[0].name).toBe('Skill A');
      expect(skills[1].name).toBe('Skill B');
    });

    it('getAlwaysOnSkills returns only always_on skills', async () => {
      const { getOrCreateUser, createAgent, createSkill, setAgentSkills, getAlwaysOnSkills } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'AlwaysOn Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const s1 = createSkill({ name: 'Always Skill', content: 'a', created_by: user.id });
      const s2 = createSkill({ name: 'OnDemand Skill', content: 'b', created_by: user.id });
      setAgentSkills(agent.id, [
        { skillId: s1.id, mode: 'always_on', sort_order: 1 },
        { skillId: s2.id, mode: 'on_demand', sort_order: 2 },
      ]);
      const skills = getAlwaysOnSkills(agent.id);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Always Skill');
    });

    it('getSkillBySlugForAgent returns skill assigned to agent', async () => {
      const { getOrCreateUser, createAgent, createSkill, setAgentSkills, getSkillBySlugForAgent } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'SlugFor Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const skill = createSkill({ name: 'Slug For Skill', content: 'content', created_by: user.id });
      setAgentSkills(agent.id, [{ skillId: skill.id, mode: 'on_demand', sort_order: 0 }]);
      const found = getSkillBySlugForAgent(agent.id, skill.slug);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Slug For Skill');

      // Not assigned to a different agent
      const agent2 = createAgent({ name: 'Other Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const notFound = getSkillBySlugForAgent(agent2.id, skill.slug);
      expect(notFound).toBeUndefined();
    });
  });

  // ============================================
  // Templates CRUD
  // ============================================

  describe('Templates CRUD', () => {
    it('createTemplate returns template with generated slug', async () => {
      const { getOrCreateUser, createTemplate } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'My Template', content: 'template content', created_by: user.id });
      expect(template.id).toBeDefined();
      expect(template.slug).toBe('my-template');
      expect(template.name).toBe('My Template');
    });

    it('createTemplate applies defaults', async () => {
      const { getOrCreateUser, createTemplate } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'Default Template', content: 'content', created_by: user.id });
      expect(template.icon_emoji).toBe('\u{1F4C4}');
      expect(template.format).toBe('markdown');
      expect(template.description).toBeNull();
      expect(template.category).toBeNull();
    });

    it('getTemplateBySlug returns created template', async () => {
      const { getOrCreateUser, createTemplate, getTemplateBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createTemplate({ name: 'Find Template', content: 'content', created_by: user.id });
      const found = getTemplateBySlug('find-template');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Template');
    });

    it('getTemplateBySlug returns undefined for nonexistent', async () => {
      const { getTemplateBySlug } = await loadDb();
      expect(getTemplateBySlug('nonexistent')).toBeUndefined();
    });

    it('getTemplateById returns template by id', async () => {
      const { getOrCreateUser, createTemplate, getTemplateById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'By ID Template', content: 'content', created_by: user.id });
      const found = getTemplateById(template.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('By ID Template');
    });

    it('getAllTemplates returns templates with agent_count', async () => {
      const { getOrCreateUser, createTemplate, getAllTemplates } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createTemplate({ name: 'Count Template', content: 'content', created_by: user.id });
      const templates = getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(1);
      const found = templates.find(t => t.name === 'Count Template');
      expect(found).toBeDefined();
      expect(found!.agent_count).toBe(0);
    });

    it('updateTemplate modifies specified fields', async () => {
      const { getOrCreateUser, createTemplate, updateTemplate, getTemplateBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'Update Template', content: 'original', created_by: user.id });
      updateTemplate(template.id, { content: 'updated content' });
      const found = getTemplateBySlug(template.slug);
      expect(found!.content).toBe('updated content');
      expect(found!.name).toBe('Update Template');
    });

    it('updateTemplate with empty data is no-op', async () => {
      const { getOrCreateUser, createTemplate, updateTemplate, getTemplateBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'NoOp Template', content: 'content', created_by: user.id });
      updateTemplate(template.id, {});
      const found = getTemplateBySlug(template.slug);
      expect(found!.name).toBe('NoOp Template');
    });

    it('deleteTemplate removes the template', async () => {
      const { getOrCreateUser, createTemplate, deleteTemplate, getTemplateBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const template = createTemplate({ name: 'Delete Template', content: 'content', created_by: user.id });
      deleteTemplate(template.id);
      expect(getTemplateBySlug(template.slug)).toBeUndefined();
    });

    it('setAgentTemplates assigns templates to agent', async () => {
      const { getOrCreateUser, createAgent, createTemplate, setAgentTemplates, getAgentTemplates } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Template Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const template = createTemplate({ name: 'Assigned Template', content: 'content', created_by: user.id });
      setAgentTemplates(agent.id, [{ templateId: template.id, sort_order: 0 }]);
      const templates = getAgentTemplates(agent.id);
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Assigned Template');
    });

    it('getAgentTemplates returns assigned templates ordered by sort_order', async () => {
      const { getOrCreateUser, createAgent, createTemplate, setAgentTemplates, getAgentTemplates } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Ordered Template Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const t1 = createTemplate({ name: 'Template A', content: 'a', created_by: user.id });
      const t2 = createTemplate({ name: 'Template B', content: 'b', created_by: user.id });
      setAgentTemplates(agent.id, [
        { templateId: t2.id, sort_order: 2 },
        { templateId: t1.id, sort_order: 1 },
      ]);
      const templates = getAgentTemplates(agent.id);
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('Template A');
      expect(templates[1].name).toBe('Template B');
    });
  });

  // ============================================
  // Context Files
  // ============================================

  describe('Context Files', () => {
    it('createWorkspaceContext creates workspace-scoped file', async () => {
      const { getOrCreateUser, createWorkspaceContext } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const cf = createWorkspaceContext('workspace.md', 'workspace content', user.id);
      expect(cf.id).toBeDefined();
      expect(cf.scope).toBe('workspace');
      expect(cf.agent_id).toBeNull();
      expect(cf.name).toBe('workspace.md');
    });

    it('getWorkspaceContextFiles returns workspace-scoped files', async () => {
      const { getOrCreateUser, createWorkspaceContext, getWorkspaceContextFiles } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createWorkspaceContext('ws1.md', 'content1', user.id);
      createWorkspaceContext('ws2.md', 'content2', user.id);
      const files = getWorkspaceContextFiles();
      expect(files.length).toBeGreaterThanOrEqual(2);
      expect(files.every(f => f.scope === 'workspace')).toBe(true);
    });

    it('getWorkspaceContextFiles returns empty when none exist', async () => {
      const { getWorkspaceContextFiles } = await loadDb();
      const files = getWorkspaceContextFiles();
      expect(files).toEqual([]);
    });

    it('updateWorkspaceContext updates content', async () => {
      const { getOrCreateUser, createWorkspaceContext, updateWorkspaceContext, getWorkspaceContextFiles } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const cf = createWorkspaceContext('update.md', 'original', user.id);
      updateWorkspaceContext(cf.id, 'updated content');
      const files = getWorkspaceContextFiles();
      const found = files.find(f => f.id === cf.id);
      expect(found!.content).toBe('updated content');
    });

    it('getAgentContextFiles returns only files for specified agent', async () => {
      const { getOrCreateUser, createAgent, getAgentContextFiles } = await loadDb();
      const db = (await import('../db')).default();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent1 = createAgent({ name: 'CF Agent 1', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const agent2 = createAgent({ name: 'CF Agent 2', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });

      db.prepare("INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)").run('a1.md', 'content1', agent1.id, user.id);
      db.prepare("INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)").run('a2.md', 'content2', agent2.id, user.id);

      const files1 = getAgentContextFiles(agent1.id);
      expect(files1).toHaveLength(1);
      expect(files1[0].name).toBe('a1.md');

      const files2 = getAgentContextFiles(agent2.id);
      expect(files2).toHaveLength(1);
      expect(files2[0].name).toBe('a2.md');
    });
  });

  // ============================================
  // API Keys
  // ============================================

  describe('API Keys', () => {
    it('setApiKey encrypts and stores, getApiKeyForProvider decrypts', async () => {
      const { getOrCreateUser, setApiKey, getApiKeyForProvider } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setApiKey('anthropic', 'sk-ant-test-key-12345678', user.id);
      const key = getApiKeyForProvider('anthropic');
      expect(key).toBe('sk-ant-test-key-12345678');
    });

    it('setApiKey upserts on same provider', async () => {
      const { getOrCreateUser, setApiKey, getApiKeyForProvider } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setApiKey('anthropic', 'old-key', user.id);
      setApiKey('anthropic', 'new-key', user.id);
      const key = getApiKeyForProvider('anthropic');
      expect(key).toBe('new-key');
    });

    it('getApiKeyForProvider falls back to env var', async () => {
      const { getApiKeyForProvider } = await loadDb();
      const originalKey = process.env.ANTHROPIC_API_KEY;
      try {
        process.env.ANTHROPIC_API_KEY = 'env-var-key-1234';
        const key = getApiKeyForProvider('anthropic');
        expect(key).toBe('env-var-key-1234');
      } finally {
        if (originalKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
      }
    });

    it('getApiKeyForProvider returns null when no key and no env var', async () => {
      const { getApiKeyForProvider } = await loadDb();
      const originalKey = process.env.ANTHROPIC_API_KEY;
      try {
        delete process.env.ANTHROPIC_API_KEY;
        const key = getApiKeyForProvider('anthropic');
        expect(key).toBeNull();
      } finally {
        if (originalKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    });

    it('deleteApiKey removes key', async () => {
      const { getOrCreateUser, setApiKey, deleteApiKey, getApiKeyForProvider } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const originalKey = process.env.ANTHROPIC_API_KEY;
      try {
        delete process.env.ANTHROPIC_API_KEY;
        setApiKey('anthropic', 'delete-me-key', user.id);
        deleteApiKey('anthropic');
        const key = getApiKeyForProvider('anthropic');
        expect(key).toBeNull();
      } finally {
        if (originalKey !== undefined) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    });

    it('getAllApiKeyStatuses returns provider/hint/set_by/updated_at', async () => {
      const { getOrCreateUser, setApiKey, getAllApiKeyStatuses } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setApiKey('anthropic', 'sk-ant-test1234', user.id);
      const statuses = getAllApiKeyStatuses();
      expect(statuses.length).toBeGreaterThanOrEqual(1);
      const found = statuses.find(s => s.provider === 'anthropic');
      expect(found).toBeDefined();
      expect(found!.key_hint).toBe('...1234');
      expect(found!.set_by).toBe(user.id);
      expect(found!.updated_at).toBeDefined();
    });

    it('setApiKey stores correct key_hint (last 4 chars)', async () => {
      const { getOrCreateUser, setApiKey, getAllApiKeyStatuses } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setApiKey('openai', 'sk-openai-abcdWXYZ', user.id);
      const statuses = getAllApiKeyStatuses();
      const found = statuses.find(s => s.provider === 'openai');
      expect(found!.key_hint).toBe('...WXYZ');
    });
  });

  // ============================================
  // Google Tokens
  // ============================================

  describe('Google Tokens', () => {
    it('setUserGoogleTokens stores, getUserGoogleTokens decrypts', async () => {
      const { getOrCreateUser, setUserGoogleTokens, getUserGoogleTokens } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setUserGoogleTokens(user.id, 'access-token-123', 'refresh-token-456', '2026-12-31T00:00:00Z');
      const tokens = getUserGoogleTokens(user.id);
      expect(tokens).not.toBeNull();
      expect(tokens!.accessToken).toBe('access-token-123');
      expect(tokens!.refreshToken).toBe('refresh-token-456');
      expect(tokens!.expiresAt).toBe('2026-12-31T00:00:00Z');
    });

    it('setUserGoogleTokens upserts on same user', async () => {
      const { getOrCreateUser, setUserGoogleTokens, getUserGoogleTokens } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setUserGoogleTokens(user.id, 'old-access', 'old-refresh', '2026-01-01T00:00:00Z');
      setUserGoogleTokens(user.id, 'new-access', 'new-refresh', '2026-12-31T00:00:00Z');
      const tokens = getUserGoogleTokens(user.id);
      expect(tokens!.accessToken).toBe('new-access');
      expect(tokens!.refreshToken).toBe('new-refresh');
    });

    it('getUserGoogleTokens returns null for nonexistent user', async () => {
      const { getUserGoogleTokens } = await loadDb();
      const tokens = getUserGoogleTokens('nonexistent-user-id');
      expect(tokens).toBeNull();
    });

    it('deleteUserGoogleTokens removes tokens', async () => {
      const { getOrCreateUser, setUserGoogleTokens, deleteUserGoogleTokens, getUserGoogleTokens } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      setUserGoogleTokens(user.id, 'access', 'refresh', '2026-12-31T00:00:00Z');
      deleteUserGoogleTokens(user.id);
      expect(getUserGoogleTokens(user.id)).toBeNull();
    });

    it('hasUserGoogleTokens returns true/false correctly', async () => {
      const { getOrCreateUser, setUserGoogleTokens, hasUserGoogleTokens } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      expect(hasUserGoogleTokens(user.id)).toBe(false);
      setUserGoogleTokens(user.id, 'access', 'refresh', '2026-12-31T00:00:00Z');
      expect(hasUserGoogleTokens(user.id)).toBe(true);
    });
  });

  // ============================================
  // MCP Servers
  // ============================================

  describe('MCP Servers', () => {
    it('createMcpServer creates server with generated slug', async () => {
      const { getOrCreateUser, createMcpServer } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'Test Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      expect(server.id).toBeDefined();
      expect(server.slug).toBe('test-server');
      expect(server.name).toBe('Test Server');
      expect(server.transport_type).toBe('stdio');
    });

    it('createMcpServer creates streamable_http server with URL', async () => {
      const { getOrCreateUser, createMcpServer } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'HTTP Server', transport_type: 'streamable_http', url: 'https://example.com/mcp', created_by: user.id });
      expect(server.transport_type).toBe('streamable_http');
      expect(server.url).toBe('https://example.com/mcp');
    });

    it('getMcpServerById returns created server', async () => {
      const { getOrCreateUser, createMcpServer, getMcpServerById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'Find Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const found = getMcpServerById(server.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Find Server');
    });

    it('getMcpServerById returns undefined for nonexistent id', async () => {
      const { getMcpServerById } = await loadDb();
      expect(getMcpServerById('nonexistent')).toBeUndefined();
    });

    it('getMcpServerBySlug returns server by slug', async () => {
      const { getOrCreateUser, createMcpServer, getMcpServerBySlug } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      createMcpServer({ name: 'Slug Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const found = getMcpServerBySlug('slug-server');
      expect(found).toBeDefined();
      expect(found!.name).toBe('Slug Server');
    });

    it('updateMcpServer modifies specified fields', async () => {
      const { getOrCreateUser, createMcpServer, updateMcpServer, getMcpServerById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'Update Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      updateMcpServer(server.id, { description: 'updated desc' });
      const found = getMcpServerById(server.id);
      expect(found!.description).toBe('updated desc');
      expect(found!.name).toBe('Update Server');
    });

    it('deleteMcpServer removes server', async () => {
      const { getOrCreateUser, createMcpServer, deleteMcpServer, getMcpServerById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'Delete Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      deleteMcpServer(server.id);
      expect(getMcpServerById(server.id)).toBeUndefined();
    });

    it('setAgentMcpServers assigns and replaces server associations', async () => {
      const { getOrCreateUser, createAgent, createMcpServer, setAgentMcpServers, getAgentMcpServers } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const s1 = createMcpServer({ name: 'Agent Server 1', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const s2 = createMcpServer({ name: 'Agent Server 2', transport_type: 'stdio', command: 'echo', created_by: user.id });

      setAgentMcpServers(agent.id, [s1.id]);
      expect(getAgentMcpServers(agent.id)).toHaveLength(1);

      setAgentMcpServers(agent.id, [s2.id]);
      const servers = getAgentMcpServers(agent.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(s2.id);
    });

    it('getAgentMcpServers returns active servers assigned to agent', async () => {
      const { getOrCreateUser, createAgent, createMcpServer, setAgentMcpServers, getAgentMcpServers, updateMcpServer } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Active MCP Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const s1 = createMcpServer({ name: 'Active Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      const s2 = createMcpServer({ name: 'Inactive Server', transport_type: 'stdio', command: 'echo', created_by: user.id });
      setAgentMcpServers(agent.id, [s1.id, s2.id]);
      updateMcpServer(s2.id, { is_active: 0 });
      const servers = getAgentMcpServers(agent.id);
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Active Server');
    });

    it('getMcpServerClientSecret decrypts and returns secret', async () => {
      const { getOrCreateUser, createMcpServer, getMcpServerClientSecret } = await loadDb();
      const { encrypt } = await import('../crypto');
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const server = createMcpServer({ name: 'Secret Server', transport_type: 'streamable_http', url: 'https://example.com', created_by: user.id });

      const enc = encrypt('test-secret');
      const db = (await import('../db')).default();
      db.prepare('UPDATE mcp_servers SET oauth_client_secret_enc = ?, oauth_client_secret_iv = ?, oauth_client_secret_tag = ? WHERE id = ?')
        .run(enc.encrypted, enc.iv, enc.authTag, server.id);

      const secret = getMcpServerClientSecret(server.id);
      expect(secret).toBe('test-secret');
    });
  });

  // ============================================
  // Scratchpad
  // ============================================

  describe('Scratchpad', () => {
    it('createScratchpadItem creates item with correct fields', async () => {
      const { getOrCreateUser, createScratchpadItem } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const item = createScratchpadItem({ title: 'Note 1', content: 'Some content', createdBy: user.id });
      expect(item.id).toBeDefined();
      expect(item.title).toBe('Note 1');
      expect(item.content).toBe('Some content');
      expect(item.created_by).toBe(user.id);
      expect(item.source_agent_id).toBeNull();
      expect(item.source_conversation_id).toBeNull();
    });

    it('createScratchpadItem stores source agent/conversation references', async () => {
      const { getOrCreateUser, createAgent, createConversation, createScratchpadItem } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const agent = createAgent({ name: 'Scratch Agent', system_prompt: 'test', provider: 'anthropic', model: 'claude-sonnet-4-20250514', created_by: user.id });
      const conv = createConversation(agent.id, user.id);
      const item = createScratchpadItem({
        title: 'Sourced Note',
        content: 'content',
        sourceAgentId: agent.id,
        sourceConversationId: conv.id,
        createdBy: user.id,
      });
      expect(item.source_agent_id).toBe(agent.id);
      expect(item.source_conversation_id).toBe(conv.id);
    });

    it('getScratchpadItems returns items for user ordered by updated_at DESC', async () => {
      const { getOrCreateUser, createScratchpadItem, getScratchpadItems, updateScratchpadItem } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const item1 = createScratchpadItem({ title: 'Note A', content: 'a', createdBy: user.id });
      const item2 = createScratchpadItem({ title: 'Note B', content: 'b', createdBy: user.id });
      // Update item1 to make it more recent
      updateScratchpadItem(item1.id, { title: 'Note A Updated' });
      const items = getScratchpadItems(user.id);
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe(item1.id);
    });

    it('getScratchpadItemById returns specific item', async () => {
      const { getOrCreateUser, createScratchpadItem, getScratchpadItemById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const item = createScratchpadItem({ title: 'Find Me', content: 'content', createdBy: user.id });
      const found = getScratchpadItemById(item.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe('Find Me');
    });

    it('updateScratchpadItem modifies title and content', async () => {
      const { getOrCreateUser, createScratchpadItem, updateScratchpadItem, getScratchpadItemById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const item = createScratchpadItem({ title: 'Original', content: 'original content', createdBy: user.id });
      updateScratchpadItem(item.id, { title: 'Updated Title', content: 'updated content' });
      const found = getScratchpadItemById(item.id);
      expect(found!.title).toBe('Updated Title');
      expect(found!.content).toBe('updated content');
    });

    it('deleteScratchpadItem removes the item', async () => {
      const { getOrCreateUser, createScratchpadItem, deleteScratchpadItem, getScratchpadItemById } = await loadDb();
      const user = getOrCreateUser('test@test.com', 'Test', null);
      const item = createScratchpadItem({ title: 'Delete Me', content: 'content', createdBy: user.id });
      deleteScratchpadItem(item.id);
      expect(getScratchpadItemById(item.id)).toBeUndefined();
    });
  });
});
