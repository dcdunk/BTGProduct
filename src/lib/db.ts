import 'server-only';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { encrypt, decrypt } from '@/lib/crypto';
import type { Agent, Conversation, Message, ContextFile, Skill, Template, ScratchpadItem, McpServer } from '@/types';

const DB_PATH = process.env.DATABASE_PATH || './data/mission-control.db';

let _db: Database.Database | null = null;
let _initialized = false;

function getDb(): Database.Database {
  if (!_db) {
    // Ensure the data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }

  if (!_initialized) {
    _initialized = true;
    initializeSchema(_db);
    runMigrations(_db);
  }

  return _db;
}

// ============================================
// Schema
// ============================================

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      avatar_emoji TEXT DEFAULT '🤖',
      system_prompt TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai', 'google')),
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
      temperature REAL DEFAULT 0.7,
      created_by TEXT NOT NULL REFERENCES users(id),
      is_shared INTEGER DEFAULT 1,
      deleted_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      active_template_id TEXT REFERENCES templates(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      tokens_in INTEGER,
      tokens_out INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS context_files (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('workspace', 'agent')),
      agent_id TEXT REFERENCES agents(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon_emoji TEXT DEFAULT '🔧',
      content TEXT NOT NULL,
      category TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_skills (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      mode TEXT NOT NULL DEFAULT 'on_demand' CHECK (mode IN ('always_on', 'on_demand')),
      sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (agent_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      icon_emoji TEXT DEFAULT '📄',
      format TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'structured')),
      content TEXT NOT NULL,
      category TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_templates (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      PRIMARY KEY (agent_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS scratchpad (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_agent_id TEXT REFERENCES agents(id),
      source_conversation_id TEXT REFERENCES conversations(id),
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      provider TEXT UNIQUE NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      key_hint TEXT NOT NULL,
      set_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      transport_type TEXT NOT NULL CHECK (transport_type IN ('stdio', 'sse', 'streamable_http')),
      command TEXT,
      args TEXT,
      env TEXT,
      url TEXT,
      headers TEXT,
      auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'headers', 'oauth')),
      oauth_client_id TEXT,
      oauth_client_secret_enc TEXT,
      oauth_client_secret_iv TEXT,
      oauth_client_secret_tag TEXT,
      oauth_scopes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_mcp_servers (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
      PRIMARY KEY (agent_id, mcp_server_id)
    );

    CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
      access_token_enc TEXT NOT NULL,
      access_token_iv TEXT NOT NULL,
      access_token_tag TEXT NOT NULL,
      refresh_token_enc TEXT,
      refresh_token_iv TEXT,
      refresh_token_tag TEXT,
      token_type TEXT NOT NULL DEFAULT 'Bearer',
      scope TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, mcp_server_id)
    );

    CREATE TABLE IF NOT EXISTS mcp_oauth_state (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id),
      mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id),
      state TEXT UNIQUE NOT NULL,
      code_verifier TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      client_secret_enc TEXT,
      client_secret_iv TEXT,
      client_secret_tag TEXT,
      client_id_issued_at INTEGER,
      client_secret_expires_at INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mcp_server_id)
    );

    CREATE TABLE IF NOT EXISTS conversation_mcp_servers (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, mcp_server_id)
    );

    CREATE TABLE IF NOT EXISTS user_google_tokens (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token_enc TEXT NOT NULL,
      access_token_iv TEXT NOT NULL,
      access_token_tag TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      refresh_token_iv TEXT NOT NULL,
      refresh_token_tag TEXT NOT NULL,
      token_expiry DATETIME NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_context_files_scope ON context_files(scope);
    CREATE INDEX IF NOT EXISTS idx_context_files_agent_id ON context_files(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agents_deleted_at ON agents(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_templates_agent_id ON agent_templates(agent_id);
  `);
}

function runMigrations(db: Database.Database) {
  // Migration: Add OAuth columns to mcp_servers for existing databases
  const columns = db.pragma('table_info(mcp_servers)') as { name: string }[];
  const columnNames = columns.map(c => c.name);
  if (!columnNames.includes('auth_type')) {
    db.exec(`
      ALTER TABLE mcp_servers ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE mcp_servers ADD COLUMN oauth_client_id TEXT;
      ALTER TABLE mcp_servers ADD COLUMN oauth_client_secret_enc TEXT;
      ALTER TABLE mcp_servers ADD COLUMN oauth_client_secret_iv TEXT;
      ALTER TABLE mcp_servers ADD COLUMN oauth_client_secret_tag TEXT;
      ALTER TABLE mcp_servers ADD COLUMN oauth_scopes TEXT;
    `);
  }

  // Migration: Rebuild mcp_servers to update transport_type CHECK constraint
  // SQLite doesn't support ALTER COLUMN, so we recreate the table
  const createSql = (db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='mcp_servers'"
  ).get() as { sql: string } | undefined)?.sql ?? '';
  // Migration: Create user_google_tokens table for existing databases
  const googleTokensExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_google_tokens'"
  ).get();
  if (!googleTokensExists) {
    db.exec(`
      CREATE TABLE user_google_tokens (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        access_token_enc TEXT NOT NULL,
        access_token_iv TEXT NOT NULL,
        access_token_tag TEXT NOT NULL,
        refresh_token_enc TEXT NOT NULL,
        refresh_token_iv TEXT NOT NULL,
        refresh_token_tag TEXT NOT NULL,
        token_expiry DATETIME NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (!createSql.includes('streamable_http')) {
    db.exec(`
      ALTER TABLE mcp_servers RENAME TO mcp_servers_old;
      CREATE TABLE mcp_servers (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        transport_type TEXT NOT NULL CHECK (transport_type IN ('stdio', 'sse', 'streamable_http')),
        command TEXT,
        args TEXT,
        env TEXT,
        url TEXT,
        headers TEXT,
        auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'headers', 'oauth')),
        oauth_client_id TEXT,
        oauth_client_secret_enc TEXT,
        oauth_client_secret_iv TEXT,
        oauth_client_secret_tag TEXT,
        oauth_scopes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO mcp_servers SELECT * FROM mcp_servers_old;
      DROP TABLE mcp_servers_old;
    `);
  }

  // Migration: Add provider/model columns to conversations for per-conversation model selection
  const convColumns = db.pragma('table_info(conversations)') as { name: string }[];
  const convColumnNames = convColumns.map(c => c.name);
  if (!convColumnNames.includes('provider')) {
    db.exec(`
      ALTER TABLE conversations ADD COLUMN provider TEXT;
      ALTER TABLE conversations ADD COLUMN model TEXT;
    `);
  }

  // Migration: Create conversation_mcp_servers table
  const convMcpExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_mcp_servers'"
  ).get();
  if (!convMcpExists) {
    db.exec(`
      CREATE TABLE conversation_mcp_servers (
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
        PRIMARY KEY (conversation_id, mcp_server_id)
      );
    `);
  }
}

// ============================================
// Seed Data
// ============================================

interface SeedAgent {
  name: string;
  slug: string;
  description: string;
  avatar_emoji: string;
  provider: string;
  model: string;
  temperature: number;
  system_prompt: string;
  context_files: Array<{ name: string; content: string }>;
}

interface SeedSkill {
  name: string;
  slug: string;
  description: string;
  icon_emoji: string;
  category: string;
  content: string;
}

interface SeedTemplate {
  name: string;
  slug: string;
  description: string;
  icon_emoji: string;
  category: string;
  format: string;
  content: string;
}

interface SeedAssignments {
  agent_skills: Array<{
    agent_slug: string;
    skill_slug: string;
    mode: string;
    sort_order: number;
  }>;
  agent_templates: Array<{
    agent_slug: string;
    template_slug: string;
    sort_order: number;
  }>;
}

function seedDatabase(adminUserId: string) {
  const db = getDb();
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  if (agentCount.count > 0) return;

  const contextDir = path.resolve(process.cwd(), 'context');

  // Seed workspace context
  const workspacePath = path.join(contextDir, 'workspace.md');
  if (fs.existsSync(workspacePath)) {
    const workspaceContent = fs.readFileSync(workspacePath, 'utf-8');
    const existingWorkspace = db.prepare(
      "SELECT COUNT(*) as count FROM context_files WHERE scope = 'workspace'"
    ).get() as { count: number };

    if (existingWorkspace.count === 0) {
      db.prepare(
        'INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, ?, NULL, ?)'
      ).run('workspace.md', workspaceContent, 'workspace', adminUserId);
    }
  }

  // Seed agents
  const agentsPath = path.join(contextDir, 'seed-agents.json');
  if (!fs.existsSync(agentsPath)) return;

  const agents: SeedAgent[] = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
  const insertAgent = db.prepare(`
    INSERT INTO agents (name, slug, description, avatar_emoji, system_prompt, provider, model, temperature, created_by, is_shared)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertContextFile = db.prepare(`
    INSERT INTO context_files (name, content, scope, agent_id, created_by)
    VALUES (?, ?, 'agent', ?, ?)
  `);

  const seedAll = db.transaction(() => {
    for (const agent of agents) {
      insertAgent.run(
        agent.name, agent.slug, agent.description, agent.avatar_emoji,
        agent.system_prompt, agent.provider, agent.model, agent.temperature,
        adminUserId
      );

      const insertedAgent = db.prepare('SELECT id FROM agents WHERE slug = ?').get(agent.slug) as { id: string };

      if (agent.context_files) {
        for (const cf of agent.context_files) {
          insertContextFile.run(cf.name, cf.content, insertedAgent.id, adminUserId);
        }
      }
    }

    // Seed skills
    const skillsPath = path.join(contextDir, 'seed-skills.json');
    if (fs.existsSync(skillsPath)) {
      const skills: SeedSkill[] = JSON.parse(fs.readFileSync(skillsPath, 'utf-8'));
      const insertSkill = db.prepare(`
        INSERT INTO skills (name, slug, description, icon_emoji, content, category, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const skill of skills) {
        insertSkill.run(
          skill.name, skill.slug, skill.description, skill.icon_emoji,
          skill.content, skill.category, adminUserId
        );
      }
    }

    // Seed templates
    const templatesPath = path.join(contextDir, 'seed-templates.json');
    if (fs.existsSync(templatesPath)) {
      const templates: SeedTemplate[] = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
      const insertTemplate = db.prepare(`
        INSERT INTO templates (name, slug, description, icon_emoji, format, content, category, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const template of templates) {
        insertTemplate.run(
          template.name, template.slug, template.description, template.icon_emoji,
          template.format, template.content, template.category, adminUserId
        );
      }
    }

    // Seed assignments
    const assignmentsPath = path.join(contextDir, 'seed-assignments.json');
    if (fs.existsSync(assignmentsPath)) {
      const assignments: SeedAssignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf-8'));

      const insertAgentSkill = db.prepare(`
        INSERT INTO agent_skills (agent_id, skill_id, mode, sort_order)
        VALUES (
          (SELECT id FROM agents WHERE slug = ?),
          (SELECT id FROM skills WHERE slug = ?),
          ?, ?
        )
      `);
      for (const as of assignments.agent_skills) {
        insertAgentSkill.run(as.agent_slug, as.skill_slug, as.mode, as.sort_order);
      }

      const insertAgentTemplate = db.prepare(`
        INSERT INTO agent_templates (agent_id, template_id, sort_order)
        VALUES (
          (SELECT id FROM agents WHERE slug = ?),
          (SELECT id FROM templates WHERE slug = ?),
          ?
        )
      `);
      for (const at of assignments.agent_templates) {
        insertAgentTemplate.run(at.agent_slug, at.template_slug, at.sort_order);
      }
    }
  });

  seedAll();
}

// ============================================
// Helper Functions
// ============================================

export function getOrCreateUser(email: string, name: string, avatarUrl: string | null): {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string;
} {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: string; email: string; name: string; avatar_url: string | null; role: string;
  } | undefined;

  if (existing) {
    db.prepare('UPDATE users SET name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, avatarUrl, existing.id);
    return existing;
  }

  // First user becomes admin
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const role = userCount.count === 0 ? 'admin' : 'member';

  const result = db.prepare(
    'INSERT INTO users (email, name, avatar_url, role) VALUES (?, ?, ?, ?) RETURNING *'
  ).get(email, name, avatarUrl, role) as {
    id: string; email: string; name: string; avatar_url: string | null; role: string;
  };

  // Seed database when first user is created
  if (role === 'admin') {
    seedDatabase(result.id);
  }

  return result;
}

export function getUserByEmail(email: string) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: string; email: string; name: string; avatar_url: string | null; role: string;
  } | undefined;
}

export function getUserById(id: string) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as {
    id: string; email: string; name: string; avatar_url: string | null; role: string;
  } | undefined;
}

export function getAllAgentsWithActivity() {
  return getDb().prepare(`
    SELECT
      a.*,
      (SELECT MAX(m.created_at) FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.agent_id = a.id) as last_active,
      (SELECT COUNT(DISTINCT c.id) FROM conversations c WHERE c.agent_id = a.id) as conversation_count
    FROM agents a
    WHERE a.deleted_at IS NULL
    ORDER BY last_active DESC NULLS LAST, a.created_at DESC
  `).all();
}

export function getAgentBySlug(slug: string) {
  return getDb().prepare('SELECT * FROM agents WHERE slug = ? AND deleted_at IS NULL').get(slug);
}

export function getAgentById(id: string) {
  return getDb().prepare('SELECT * FROM agents WHERE id = ? AND deleted_at IS NULL').get(id);
}

// ============================================
// Conversation Helpers
// ============================================

export function createConversation(agentId: string, userId: string, provider?: string, model?: string): Conversation {
  return getDb().prepare(
    'INSERT INTO conversations (agent_id, user_id, provider, model) VALUES (?, ?, ?, ?) RETURNING *'
  ).get(agentId, userId, provider ?? null, model ?? null) as Conversation;
}

export function getConversationById(id: string): Conversation | undefined {
  return getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Conversation | undefined;
}

export function getConversationsByAgentId(agentId: string, userId: string): Pick<Conversation, 'id' | 'title' | 'updated_at'>[] {
  return getDb().prepare(
    'SELECT id, title, updated_at FROM conversations WHERE agent_id = ? AND user_id = ? ORDER BY updated_at DESC'
  ).all(agentId, userId) as Pick<Conversation, 'id' | 'title' | 'updated_at'>[];
}

export function updateConversationTitle(id: string, title: string): void {
  getDb().prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, id);
}

export function touchConversation(id: string): void {
  getDb().prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

export function setActiveTemplate(conversationId: string, templateId: string | null): void {
  getDb().prepare('UPDATE conversations SET active_template_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(templateId, conversationId);
}

export function deleteConversation(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
  db.prepare('DELETE FROM conversation_mcp_servers WHERE conversation_id = ?').run(id);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function updateConversationModel(id: string, provider: string, model: string): void {
  getDb().prepare(
    'UPDATE conversations SET provider = ?, model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(provider, model, id);
}

export function getConversationMcpServers(conversationId: string): McpServer[] {
  return getDb().prepare(`
    SELECT ms.* FROM mcp_servers ms
    JOIN conversation_mcp_servers cms ON cms.mcp_server_id = ms.id
    WHERE cms.conversation_id = ? AND ms.is_active = 1
    ORDER BY ms.name ASC
  `).all(conversationId) as McpServer[];
}

export function setConversationMcpServers(conversationId: string, serverIds: string[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM conversation_mcp_servers WHERE conversation_id = ?').run(conversationId);
    const insert = db.prepare('INSERT INTO conversation_mcp_servers (conversation_id, mcp_server_id) VALUES (?, ?)');
    for (const serverId of serverIds) {
      insert.run(conversationId, serverId);
    }
  });
  tx();
}

export function getActiveMcpServers(): McpServer[] {
  return getDb().prepare('SELECT * FROM mcp_servers WHERE is_active = 1 ORDER BY name ASC').all() as McpServer[];
}

// ============================================
// Message Helpers
// ============================================

export function createMessage(data: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  tokens_in?: number;
  tokens_out?: number;
}): Message {
  return getDb().prepare(
    'INSERT INTO messages (conversation_id, role, content, provider, model, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).get(
    data.conversationId, data.role, data.content,
    data.provider ?? null, data.model ?? null,
    data.tokens_in ?? null, data.tokens_out ?? null
  ) as Message;
}

export function getMessagesByConversationId(conversationId: string): Message[] {
  return getDb().prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(conversationId) as Message[];
}

// ============================================
// Context / Skill / Template Query Helpers
// ============================================

export function getWorkspaceContextFiles(): ContextFile[] {
  return getDb().prepare(
    "SELECT * FROM context_files WHERE scope = 'workspace'"
  ).all() as ContextFile[];
}

export function getAgentContextFiles(agentId: string): ContextFile[] {
  return getDb().prepare(
    "SELECT * FROM context_files WHERE scope = 'agent' AND agent_id = ?"
  ).all(agentId) as ContextFile[];
}

export function getAlwaysOnSkills(agentId: string): Skill[] {
  return getDb().prepare(`
    SELECT s.* FROM skills s
    JOIN agent_skills aks ON s.id = aks.skill_id
    WHERE aks.agent_id = ? AND aks.mode = 'always_on'
    ORDER BY aks.sort_order ASC
  `).all(agentId) as Skill[];
}

export function getTemplateById(id: string): Template | undefined {
  return getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id) as Template | undefined;
}

export function getSkillBySlugForAgent(agentId: string, skillSlug: string): Skill | undefined {
  return getDb().prepare(`
    SELECT s.* FROM skills s
    JOIN agent_skills aks ON s.id = aks.skill_id
    WHERE aks.agent_id = ? AND s.slug = ?
  `).get(agentId, skillSlug) as Skill | undefined;
}

// ============================================
// API Key Resolution
// ============================================

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
};

export function getApiKeyForProvider(provider: string): string | null {
  // Try database first
  const record = getDb().prepare(
    'SELECT encrypted_key, iv, auth_tag FROM api_keys WHERE provider = ?'
  ).get(provider) as { encrypted_key: string; iv: string; auth_tag: string } | undefined;

  if (record) {
    try {
      const { decrypt } = require('./crypto') as typeof import('./crypto');
      return decrypt(record.encrypted_key, record.iv, record.auth_tag);
    } catch {
      // Fall through to env var
    }
  }

  // Fall back to environment variable
  const envKey = ENV_KEY_MAP[provider];
  return envKey ? process.env[envKey] ?? null : null;
}

// ============================================
// Google OAuth Tokens
// ============================================

export function setUserGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): void {
  const accessEnc = encrypt(accessToken);
  const refreshEnc = encrypt(refreshToken);
  getDb().prepare(`
    INSERT INTO user_google_tokens (user_id, access_token_enc, access_token_iv, access_token_tag,
      refresh_token_enc, refresh_token_iv, refresh_token_tag, token_expiry, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      access_token_iv = excluded.access_token_iv,
      access_token_tag = excluded.access_token_tag,
      refresh_token_enc = excluded.refresh_token_enc,
      refresh_token_iv = excluded.refresh_token_iv,
      refresh_token_tag = excluded.refresh_token_tag,
      token_expiry = excluded.token_expiry,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    userId,
    accessEnc.encrypted, accessEnc.iv, accessEnc.authTag,
    refreshEnc.encrypted, refreshEnc.iv, refreshEnc.authTag,
    expiresAt
  );
}

export function getUserGoogleTokens(userId: string): {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
} | null {
  const record = getDb().prepare(
    'SELECT * FROM user_google_tokens WHERE user_id = ?'
  ).get(userId) as {
    access_token_enc: string; access_token_iv: string; access_token_tag: string;
    refresh_token_enc: string; refresh_token_iv: string; refresh_token_tag: string;
    token_expiry: string;
  } | undefined;

  if (!record) return null;

  try {
    return {
      accessToken: decrypt(record.access_token_enc, record.access_token_iv, record.access_token_tag),
      refreshToken: decrypt(record.refresh_token_enc, record.refresh_token_iv, record.refresh_token_tag),
      expiresAt: record.token_expiry,
    };
  } catch {
    return null;
  }
}

export function deleteUserGoogleTokens(userId: string): void {
  getDb().prepare('DELETE FROM user_google_tokens WHERE user_id = ?').run(userId);
}

export function hasUserGoogleTokens(userId: string): boolean {
  const record = getDb().prepare(
    'SELECT 1 FROM user_google_tokens WHERE user_id = ?'
  ).get(userId);
  return !!record;
}

// ============================================
// Agent CRUD
// ============================================

export function getAllAgents(): Agent[] {
  return getDb().prepare('SELECT * FROM agents WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as Agent[];
}

export function createAgent(data: {
  name: string;
  description?: string;
  avatar_emoji?: string;
  system_prompt: string;
  provider: string;
  model: string;
  temperature?: number;
  created_by: string;
  is_shared?: number;
}): Agent {
  const slug = generateSlug(data.name, 'agents');
  return getDb().prepare(`
    INSERT INTO agents (name, slug, description, avatar_emoji, system_prompt, provider, model, temperature, created_by, is_shared)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(
    data.name, slug, data.description ?? null, data.avatar_emoji ?? '🤖',
    data.system_prompt, data.provider, data.model, data.temperature ?? 0.7,
    data.created_by, data.is_shared ?? 1
  ) as Agent;
}

export function updateAgent(id: string, data: {
  name?: string;
  description?: string;
  avatar_emoji?: string;
  system_prompt?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  is_shared?: number;
}): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.avatar_emoji !== undefined) { fields.push('avatar_emoji = ?'); values.push(data.avatar_emoji); }
  if (data.system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(data.system_prompt); }
  if (data.provider !== undefined) { fields.push('provider = ?'); values.push(data.provider); }
  if (data.model !== undefined) { fields.push('model = ?'); values.push(data.model); }
  if (data.temperature !== undefined) { fields.push('temperature = ?'); values.push(data.temperature); }
  if (data.is_shared !== undefined) { fields.push('is_shared = ?'); values.push(data.is_shared); }

  if (fields.length === 0) return;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  getDb().prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function softDeleteAgent(id: string): void {
  getDb().prepare('UPDATE agents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

// ============================================
// Skills CRUD
// ============================================

export function getAllSkills(): (Skill & { agent_count: number })[] {
  return getDb().prepare(`
    SELECT s.*, COUNT(aks.agent_id) as agent_count
    FROM skills s
    LEFT JOIN agent_skills aks ON s.id = aks.skill_id
    GROUP BY s.id
    ORDER BY s.category ASC, s.name ASC
  `).all() as (Skill & { agent_count: number })[];
}

export function getSkillBySlug(slug: string): Skill | undefined {
  return getDb().prepare('SELECT * FROM skills WHERE slug = ?').get(slug) as Skill | undefined;
}

export function createSkill(data: {
  name: string;
  description?: string;
  icon_emoji?: string;
  content: string;
  category?: string;
  created_by: string;
}): Skill {
  const slug = generateSlug(data.name, 'skills');
  return getDb().prepare(`
    INSERT INTO skills (name, slug, description, icon_emoji, content, category, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(
    data.name, slug, data.description ?? null, data.icon_emoji ?? '🔧',
    data.content, data.category ?? null, data.created_by
  ) as Skill;
}

export function updateSkill(id: string, data: {
  name?: string;
  description?: string;
  icon_emoji?: string;
  content?: string;
  category?: string;
}): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.icon_emoji !== undefined) { fields.push('icon_emoji = ?'); values.push(data.icon_emoji); }
  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }

  if (fields.length === 0) return;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  getDb().prepare(`UPDATE skills SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteSkill(id: string): void {
  getDb().prepare('DELETE FROM skills WHERE id = ?').run(id);
}

export function getAgentSkills(agentId: string): (Skill & { mode: string; sort_order: number })[] {
  return getDb().prepare(`
    SELECT s.*, aks.mode, aks.sort_order FROM skills s
    JOIN agent_skills aks ON s.id = aks.skill_id
    WHERE aks.agent_id = ?
    ORDER BY aks.sort_order ASC
  `).all(agentId) as (Skill & { mode: string; sort_order: number })[];
}

export function setAgentSkills(agentId: string, assignments: { skillId: string; mode: string; sort_order: number }[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM agent_skills WHERE agent_id = ?').run(agentId);
    const insert = db.prepare('INSERT INTO agent_skills (agent_id, skill_id, mode, sort_order) VALUES (?, ?, ?, ?)');
    for (const a of assignments) {
      insert.run(agentId, a.skillId, a.mode, a.sort_order);
    }
  });
  tx();
}

// ============================================
// Templates CRUD
// ============================================

export function getAllTemplates(): (Template & { agent_count: number })[] {
  return getDb().prepare(`
    SELECT t.*, COUNT(at2.agent_id) as agent_count
    FROM templates t
    LEFT JOIN agent_templates at2 ON t.id = at2.template_id
    GROUP BY t.id
    ORDER BY t.category ASC, t.name ASC
  `).all() as (Template & { agent_count: number })[];
}

export function getTemplateBySlug(slug: string): Template | undefined {
  return getDb().prepare('SELECT * FROM templates WHERE slug = ?').get(slug) as Template | undefined;
}

export function createTemplate(data: {
  name: string;
  description?: string;
  icon_emoji?: string;
  format?: string;
  content: string;
  category?: string;
  created_by: string;
}): Template {
  const slug = generateSlug(data.name, 'templates');
  return getDb().prepare(`
    INSERT INTO templates (name, slug, description, icon_emoji, format, content, category, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
  `).get(
    data.name, slug, data.description ?? null, data.icon_emoji ?? '📄',
    data.format ?? 'markdown', data.content, data.category ?? null, data.created_by
  ) as Template;
}

export function updateTemplate(id: string, data: {
  name?: string;
  description?: string;
  icon_emoji?: string;
  format?: string;
  content?: string;
  category?: string;
}): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.icon_emoji !== undefined) { fields.push('icon_emoji = ?'); values.push(data.icon_emoji); }
  if (data.format !== undefined) { fields.push('format = ?'); values.push(data.format); }
  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }

  if (fields.length === 0) return;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  getDb().prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
}

export function getAgentTemplates(agentId: string): (Template & { sort_order: number })[] {
  return getDb().prepare(`
    SELECT t.*, at2.sort_order FROM templates t
    JOIN agent_templates at2 ON t.id = at2.template_id
    WHERE at2.agent_id = ?
    ORDER BY at2.sort_order ASC
  `).all(agentId) as (Template & { sort_order: number })[];
}

export function setAgentTemplates(agentId: string, assignments: { templateId: string; sort_order: number }[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM agent_templates WHERE agent_id = ?').run(agentId);
    const insert = db.prepare('INSERT INTO agent_templates (agent_id, template_id, sort_order) VALUES (?, ?, ?)');
    for (const a of assignments) {
      insert.run(agentId, a.templateId, a.sort_order);
    }
  });
  tx();
}

// ============================================
// Workspace Context CRUD
// ============================================

export function updateWorkspaceContext(id: string, content: string): void {
  getDb().prepare("UPDATE context_files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND scope = 'workspace'").run(content, id);
}

export function createWorkspaceContext(name: string, content: string, userId: string): ContextFile {
  return getDb().prepare(
    "INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'workspace', NULL, ?) RETURNING *"
  ).get(name, content, userId) as ContextFile;
}

// ============================================
// API Key Management
// ============================================

export function getAllApiKeyStatuses(): { provider: string; key_hint: string; set_by: string; updated_at: string }[] {
  return getDb().prepare('SELECT provider, key_hint, set_by, updated_at FROM api_keys').all() as {
    provider: string; key_hint: string; set_by: string; updated_at: string;
  }[];
}

export function setApiKey(provider: string, plaintextKey: string, userId: string): void {
  const { encrypt } = require('./crypto') as typeof import('./crypto');
  const { encrypted, iv, authTag } = encrypt(plaintextKey);
  const keyHint = '...' + plaintextKey.slice(-4);
  getDb().prepare(`
    INSERT INTO api_keys (provider, encrypted_key, iv, auth_tag, key_hint, set_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      encrypted_key = excluded.encrypted_key, iv = excluded.iv, auth_tag = excluded.auth_tag,
      key_hint = excluded.key_hint, set_by = excluded.set_by, updated_at = CURRENT_TIMESTAMP
  `).run(provider, encrypted, iv, authTag, keyHint, userId);
}

export function deleteApiKey(provider: string): void {
  getDb().prepare('DELETE FROM api_keys WHERE provider = ?').run(provider);
}

// ============================================
// Agent Duplication Helpers
// ============================================

export function duplicateAgentContextFiles(sourceAgentId: string, targetAgentId: string, userId: string): void {
  const db = getDb();
  const files = getAgentContextFiles(sourceAgentId);
  const insert = db.prepare(
    "INSERT INTO context_files (name, content, scope, agent_id, created_by) VALUES (?, ?, 'agent', ?, ?)"
  );
  for (const f of files) {
    insert.run(f.name, f.content, targetAgentId, userId);
  }
}

// ============================================
// Search Helpers
// ============================================

export function searchMessages(userId: string, query: string, agentId?: string): Array<{
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  agent_id: string;
  agent_name: string;
  agent_slug: string;
  agent_emoji: string;
  role: string;
  content: string;
  created_at: string;
}> {
  const db = getDb();
  const likeQuery = `%${query}%`;
  const sql = `
    SELECT m.id as message_id, c.id as conversation_id, c.title as conversation_title,
           a.id as agent_id, a.name as agent_name, a.slug as agent_slug, a.avatar_emoji as agent_emoji,
           m.role, m.content, m.created_at
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    JOIN agents a ON c.agent_id = a.id
    WHERE c.user_id = ? AND m.content LIKE ? AND a.deleted_at IS NULL
    ${agentId ? 'AND c.agent_id = ?' : ''}
    ORDER BY m.created_at DESC
    LIMIT 50
  `;
  const params = agentId ? [userId, likeQuery, agentId] : [userId, likeQuery];
  return db.prepare(sql).all(...params) as Array<{
    message_id: string; conversation_id: string; conversation_title: string | null;
    agent_id: string; agent_name: string; agent_slug: string; agent_emoji: string;
    role: string; content: string; created_at: string;
  }>;
}

// ============================================
// Scratchpad Helpers
// ============================================

export function getScratchpadItems(userId: string): ScratchpadItem[] {
  return getDb().prepare(
    'SELECT * FROM scratchpad WHERE created_by = ? ORDER BY updated_at DESC'
  ).all(userId) as ScratchpadItem[];
}

export function getScratchpadItemById(id: string): ScratchpadItem | undefined {
  return getDb().prepare('SELECT * FROM scratchpad WHERE id = ?').get(id) as ScratchpadItem | undefined;
}

export function createScratchpadItem(data: {
  title: string;
  content: string;
  sourceAgentId?: string;
  sourceConversationId?: string;
  createdBy: string;
}): ScratchpadItem {
  return getDb().prepare(`
    INSERT INTO scratchpad (title, content, source_agent_id, source_conversation_id, created_by)
    VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `).get(
    data.title,
    data.content,
    data.sourceAgentId || null,
    data.sourceConversationId || null,
    data.createdBy
  ) as ScratchpadItem;
}

export function updateScratchpadItem(id: string, data: { title?: string; content?: string }): void {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
  if (data.content !== undefined) { fields.push('content = ?'); values.push(data.content); }

  if (fields.length === 0) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  getDb().prepare(`UPDATE scratchpad SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteScratchpadItem(id: string): void {
  getDb().prepare('DELETE FROM scratchpad WHERE id = ?').run(id);
}

// ============================================
// Slug Generation
// ============================================

export function generateSlug(name: string, table: string): string {
  const db = getDb();
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  let slug = base;
  let counter = 2;
  while (true) {
    const existing = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`).get(slug);
    if (!existing) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
}

// ============================================
// MCP Servers
// ============================================

export function getMcpServers(): McpServer[] {
  return getDb().prepare('SELECT * FROM mcp_servers ORDER BY name ASC').all() as McpServer[];
}

export function getMcpServerById(id: string): McpServer | undefined {
  return getDb().prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as McpServer | undefined;
}

export function getMcpServerClientSecret(id: string): string | null {
  const row = getDb().prepare(
    'SELECT oauth_client_secret_enc, oauth_client_secret_iv, oauth_client_secret_tag FROM mcp_servers WHERE id = ?'
  ).get(id) as { oauth_client_secret_enc: string | null; oauth_client_secret_iv: string | null; oauth_client_secret_tag: string | null } | undefined;
  if (!row?.oauth_client_secret_enc || !row.oauth_client_secret_iv || !row.oauth_client_secret_tag) return null;
  return decrypt(row.oauth_client_secret_enc, row.oauth_client_secret_iv, row.oauth_client_secret_tag);
}

export function getMcpServerBySlug(slug: string): McpServer | undefined {
  return getDb().prepare('SELECT * FROM mcp_servers WHERE slug = ?').get(slug) as McpServer | undefined;
}

export function createMcpServer(data: {
  name: string;
  description?: string | null;
  transport_type: 'stdio' | 'sse' | 'streamable_http';
  command?: string | null;
  args?: string | null;
  env?: string | null;
  url?: string | null;
  headers?: string | null;
  auth_type?: 'none' | 'headers' | 'oauth';
  oauth_client_id?: string | null;
  oauth_client_secret_enc?: string | null;
  oauth_client_secret_iv?: string | null;
  oauth_client_secret_tag?: string | null;
  oauth_scopes?: string | null;
  created_by: string;
}): McpServer {
  const db = getDb();
  const slug = generateSlug(data.name, 'mcp_servers');
  db.prepare(`
    INSERT INTO mcp_servers (name, slug, description, transport_type, command, args, env, url, headers, auth_type, oauth_client_id, oauth_client_secret_enc, oauth_client_secret_iv, oauth_client_secret_tag, oauth_scopes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.name, slug, data.description ?? null, data.transport_type,
    data.command ?? null, data.args ?? null, data.env ?? null,
    data.url ?? null, data.headers ?? null,
    data.auth_type ?? 'none', data.oauth_client_id ?? null,
    data.oauth_client_secret_enc ?? null, data.oauth_client_secret_iv ?? null, data.oauth_client_secret_tag ?? null,
    data.oauth_scopes ?? null, data.created_by
  );
  return getMcpServerBySlug(slug)!;
}

export function updateMcpServer(id: string, data: Partial<{
  name: string;
  description: string | null;
  transport_type: 'stdio' | 'sse' | 'streamable_http';
  command: string | null;
  args: string | null;
  env: string | null;
  url: string | null;
  headers: string | null;
  auth_type: 'none' | 'headers' | 'oauth';
  oauth_client_id: string | null;
  oauth_client_secret_enc: string | null;
  oauth_client_secret_iv: string | null;
  oauth_client_secret_tag: string | null;
  oauth_scopes: string | null;
  is_active: number;
}>): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  if (fields.length === 0) return;
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  getDb().prepare(`UPDATE mcp_servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteMcpServer(id: string): void {
  getDb().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
}

export function getAgentMcpServers(agentId: string): McpServer[] {
  return getDb().prepare(`
    SELECT ms.* FROM mcp_servers ms
    JOIN agent_mcp_servers ams ON ams.mcp_server_id = ms.id
    WHERE ams.agent_id = ? AND ms.is_active = 1
    ORDER BY ms.name ASC
  `).all(agentId) as McpServer[];
}

export function setAgentMcpServers(agentId: string, serverIds: string[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM agent_mcp_servers WHERE agent_id = ?').run(agentId);
    const insert = db.prepare('INSERT INTO agent_mcp_servers (agent_id, mcp_server_id) VALUES (?, ?)');
    for (const serverId of serverIds) {
      insert.run(agentId, serverId);
    }
  });
  tx();
}

// ============================================
// MCP OAuth Tokens
// ============================================

export function getOAuthTokens(userId: string, mcpServerId: string): {
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  scope: string | null;
  expires_at: string | null;
} | undefined {
  const row = getDb().prepare(
    'SELECT * FROM mcp_oauth_tokens WHERE user_id = ? AND mcp_server_id = ?'
  ).get(userId, mcpServerId) as {
    access_token_enc: string;
    access_token_iv: string;
    access_token_tag: string;
    refresh_token_enc: string | null;
    refresh_token_iv: string | null;
    refresh_token_tag: string | null;
    token_type: string;
    scope: string | null;
    expires_at: string | null;
  } | undefined;

  if (!row) return undefined;

  return {
    access_token: decrypt(row.access_token_enc, row.access_token_iv, row.access_token_tag),
    refresh_token: row.refresh_token_enc && row.refresh_token_iv && row.refresh_token_tag
      ? decrypt(row.refresh_token_enc, row.refresh_token_iv, row.refresh_token_tag)
      : null,
    token_type: row.token_type,
    scope: row.scope,
    expires_at: row.expires_at,
  };
}

export function saveOAuthTokens(userId: string, mcpServerId: string, tokens: {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string;
  scope?: string | null;
  expires_in?: number | null;
}): void {
  const db = getDb();
  const accessEnc = encrypt(tokens.access_token);
  let refreshEnc: { encrypted: string; iv: string; authTag: string } | null = null;
  if (tokens.refresh_token) {
    refreshEnc = encrypt(tokens.refresh_token);
  }
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO mcp_oauth_tokens (user_id, mcp_server_id, access_token_enc, access_token_iv, access_token_tag, refresh_token_enc, refresh_token_iv, refresh_token_tag, token_type, scope, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, mcp_server_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      access_token_iv = excluded.access_token_iv,
      access_token_tag = excluded.access_token_tag,
      refresh_token_enc = excluded.refresh_token_enc,
      refresh_token_iv = excluded.refresh_token_iv,
      refresh_token_tag = excluded.refresh_token_tag,
      token_type = excluded.token_type,
      scope = excluded.scope,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    userId, mcpServerId,
    accessEnc.encrypted, accessEnc.iv, accessEnc.authTag,
    refreshEnc?.encrypted ?? null, refreshEnc?.iv ?? null, refreshEnc?.authTag ?? null,
    tokens.token_type ?? 'Bearer', tokens.scope ?? null, expiresAt
  );
}

export function deleteOAuthTokens(userId: string, mcpServerId: string): void {
  getDb().prepare('DELETE FROM mcp_oauth_tokens WHERE user_id = ? AND mcp_server_id = ?').run(userId, mcpServerId);
}

export function getUserOAuthStatuses(userId: string): { mcp_server_id: string; connected: boolean; expires_at: string | null }[] {
  const rows = getDb().prepare(`
    SELECT ms.id AS mcp_server_id,
           CASE WHEN mot.id IS NOT NULL THEN 1 ELSE 0 END AS connected,
           mot.expires_at
    FROM mcp_servers ms
    LEFT JOIN mcp_oauth_tokens mot ON mot.mcp_server_id = ms.id AND mot.user_id = ?
    WHERE ms.auth_type = 'oauth'
  `).all(userId) as { mcp_server_id: string; connected: number; expires_at: string | null }[];

  return rows.map(r => ({
    mcp_server_id: r.mcp_server_id,
    connected: r.connected === 1,
    expires_at: r.expires_at,
  }));
}

// ============================================
// MCP OAuth State (PKCE)
// ============================================

export function createOAuthState(data: {
  userId: string;
  mcpServerId: string;
  state: string;
  codeVerifier?: string;
}): void {
  getDb().prepare(`
    INSERT INTO mcp_oauth_state (user_id, mcp_server_id, state, code_verifier)
    VALUES (?, ?, ?, ?)
  `).run(data.userId, data.mcpServerId, data.state, data.codeVerifier ?? '');
}

export function getOAuthState(state: string): {
  user_id: string;
  mcp_server_id: string;
  state: string;
  code_verifier: string;
} | undefined {
  return getDb().prepare('SELECT * FROM mcp_oauth_state WHERE state = ?').get(state) as {
    user_id: string;
    mcp_server_id: string;
    state: string;
    code_verifier: string;
  } | undefined;
}

export function updateOAuthStateVerifier(state: string, codeVerifier: string): void {
  getDb().prepare('UPDATE mcp_oauth_state SET code_verifier = ? WHERE state = ?').run(codeVerifier, state);
}

export function deleteOAuthState(state: string): void {
  getDb().prepare('DELETE FROM mcp_oauth_state WHERE state = ?').run(state);
}

export function cleanExpiredOAuthStates(): void {
  getDb().prepare("DELETE FROM mcp_oauth_state WHERE created_at < datetime('now', '-10 minutes')").run();
}

// ============================================
// MCP OAuth Dynamic Client Registration
// ============================================

export function getOAuthClientRegistration(mcpServerId: string): {
  client_id: string;
  client_secret: string | null;
  client_id_issued_at: number | null;
  client_secret_expires_at: number | null;
} | undefined {
  const row = getDb().prepare('SELECT * FROM mcp_oauth_clients WHERE mcp_server_id = ?').get(mcpServerId) as {
    client_id: string;
    client_secret_enc: string | null;
    client_secret_iv: string | null;
    client_secret_tag: string | null;
    client_id_issued_at: number | null;
    client_secret_expires_at: number | null;
  } | undefined;

  if (!row) return undefined;

  return {
    client_id: row.client_id,
    client_secret: row.client_secret_enc && row.client_secret_iv && row.client_secret_tag
      ? decrypt(row.client_secret_enc, row.client_secret_iv, row.client_secret_tag)
      : null,
    client_id_issued_at: row.client_id_issued_at,
    client_secret_expires_at: row.client_secret_expires_at,
  };
}

export function saveOAuthClientRegistration(mcpServerId: string, info: {
  client_id: string;
  client_secret?: string | null;
  client_id_issued_at?: number | null;
  client_secret_expires_at?: number | null;
}): void {
  const db = getDb();
  let secretEnc: { encrypted: string; iv: string; authTag: string } | null = null;
  if (info.client_secret) {
    secretEnc = encrypt(info.client_secret);
  }

  db.prepare(`
    INSERT INTO mcp_oauth_clients (mcp_server_id, client_id, client_secret_enc, client_secret_iv, client_secret_tag, client_id_issued_at, client_secret_expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(mcp_server_id) DO UPDATE SET
      client_id = excluded.client_id,
      client_secret_enc = excluded.client_secret_enc,
      client_secret_iv = excluded.client_secret_iv,
      client_secret_tag = excluded.client_secret_tag,
      client_id_issued_at = excluded.client_id_issued_at,
      client_secret_expires_at = excluded.client_secret_expires_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    mcpServerId, info.client_id,
    secretEnc?.encrypted ?? null, secretEnc?.iv ?? null, secretEnc?.authTag ?? null,
    info.client_id_issued_at ?? null, info.client_secret_expires_at ?? null
  );
}

export default getDb;
