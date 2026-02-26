import { vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { Agent } from '@/types';

export function freshDbPath(): string {
  return path.join(os.tmpdir(), `mc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

let _dbPath: string;

export function getDbPath(): string {
  return _dbPath;
}

export async function loadDb() {
  vi.resetModules();
  _dbPath = freshDbPath();
  process.env.DATABASE_PATH = _dbPath;
  const mod = await import('../db');
  return mod;
}

export async function setupWithUser() {
  const mod = await loadDb();
  const user = mod.getOrCreateUser('test@test.com', 'Test User', null);
  const db = mod.default();
  return { ...mod, user, db };
}

export function cleanupDb(dbPath: string) {
  try {
    if (dbPath && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  } catch {
    // ignore cleanup errors
  }
}

export function makeAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: 'agent-1',
    name: 'Test Agent',
    slug: 'test-agent',
    description: null,
    avatar_emoji: '🤖',
    system_prompt: 'You are a test agent.',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    created_by: 'user-1',
    is_shared: 1,
    deleted_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}
