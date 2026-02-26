import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db module before importing auth
vi.mock('../db', () => ({
  getOrCreateUser: vi.fn(() => ({
    id: 'user-123',
    email: 'test@blueteesgolf.com',
    name: 'Test User',
    avatar_url: null,
    role: 'admin',
  })),
}));

import { authOptions } from '../auth';
import { getOrCreateUser } from '../db';

// Extract callbacks for direct testing
const { signIn, jwt, session } = authOptions.callbacks!;

describe('auth callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOWED_EMAIL_DOMAIN;
  });

  describe('signIn callback', () => {
    const baseArgs = {
      account: null as never,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    };

    it('rejects if no email', async () => {
      const result = await signIn!({
        user: { id: '1', name: 'No Email' },
        ...baseArgs,
      });
      expect(result).toBe(false);
    });

    it('rejects if email domain does not match ALLOWED_EMAIL_DOMAIN', async () => {
      process.env.ALLOWED_EMAIL_DOMAIN = 'blueteesgolf.com';
      const result = await signIn!({
        user: { id: '1', email: 'user@other.com', name: 'Other' },
        ...baseArgs,
      });
      expect(result).toBe(false);
    });

    it('allows matching domain', async () => {
      process.env.ALLOWED_EMAIL_DOMAIN = 'blueteesgolf.com';
      const result = await signIn!({
        user: { id: '1', email: 'user@blueteesgolf.com', name: 'User' },
        ...baseArgs,
      });
      expect(result).toBe(true);
    });

    it('allows any email when ALLOWED_EMAIL_DOMAIN is unset', async () => {
      const result = await signIn!({
        user: { id: '1', email: 'anyone@anywhere.com', name: 'Anyone' },
        ...baseArgs,
      });
      expect(result).toBe(true);
    });
  });

  describe('jwt callback', () => {
    it('stores userId and role in token', async () => {
      const token = await jwt!({
        token: { sub: '1' },
        user: { id: '1', email: 'test@blueteesgolf.com', name: 'Test' },
        account: null,
        trigger: 'signIn',
      });
      expect(token.userId).toBe('user-123');
      expect(token.role).toBe('admin');
      expect(getOrCreateUser).toHaveBeenCalledWith(
        'test@blueteesgolf.com',
        'Test',
        null
      );
    });
  });

  describe('session callback', () => {
    it('copies userId and role to session.user', async () => {
      const result = await session!({
        session: { user: { name: 'Test', email: 'test@test.com' }, expires: '' },
        token: { userId: 'user-123', role: 'admin', sub: '1' },
        trigger: 'update',
        newSession: undefined,
      });
      expect((result.user as { id?: string }).id).toBe('user-123');
      expect((result.user as { role?: string }).role).toBe('admin');
    });
  });
});
