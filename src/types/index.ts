export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_emoji: string;
  system_prompt: string;
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  temperature: number;
  created_by: string;
  is_shared: number; // SQLite boolean
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentWithActivity extends Agent {
  last_active: string | null;
  conversation_count: number;
}

export interface Conversation {
  id: string;
  title: string | null;
  agent_id: string;
  user_id: string;
  active_template_id: string | null;
  provider: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface ContextFile {
  id: string;
  name: string;
  content: string;
  scope: 'workspace' | 'agent';
  agent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_emoji: string;
  content: string;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AgentSkill {
  agent_id: string;
  skill_id: string;
  mode: 'always_on' | 'on_demand';
  sort_order: number;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_emoji: string;
  format: 'markdown' | 'structured';
  content: string;
  category: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AgentTemplate {
  agent_id: string;
  template_id: string;
  sort_order: number;
}

export interface ScratchpadItem {
  id: string;
  title: string;
  content: string;
  source_agent_id: string | null;
  source_conversation_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  provider: 'anthropic' | 'openai' | 'google';
  encrypted_key: string;
  iv: string;
  auth_tag: string;
  key_hint: string;
  set_by: string;
  created_at: string;
  updated_at: string;
}

export interface McpServer {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  transport_type: 'stdio' | 'sse' | 'streamable_http';
  command: string | null;
  args: string | null;
  env: string | null;
  url: string | null;
  headers: string | null;
  auth_type: 'none' | 'headers' | 'oauth';
  oauth_client_id: string | null;
  oauth_scopes: string | null;
  is_active: number; // SQLite boolean
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface McpOAuthStatus {
  mcp_server_id: string;
  connected: boolean;
  expires_at: string | null;
}

export type Provider = 'anthropic' | 'openai' | 'google';

export const PROVIDER_MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  google: ['gemini-2.0-flash', 'gemini-2.0-pro'],
};

export const PROVIDER_DISPLAY_NAMES: Record<Provider, string> = {
  anthropic: 'Claude',
  openai: 'GPT',
  google: 'Gemini',
};

export const DEFAULT_PROVIDER: Provider = 'anthropic';
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
export const DEFAULT_TEMPERATURE = 0.7;
