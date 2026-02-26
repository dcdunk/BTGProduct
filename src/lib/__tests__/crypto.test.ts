import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../crypto';

describe('crypto', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET =
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  });

  it('round-trips encrypt/decrypt', () => {
    const plaintext = 'sk-my-secret-api-key-12345';
    const { encrypted, iv, authTag } = encrypt(plaintext);
    const result = decrypt(encrypted, iv, authTag);
    expect(result).toBe(plaintext);
  });

  it('produces different IVs on each encryption', () => {
    const { iv: iv1 } = encrypt('same text');
    const { iv: iv2 } = encrypt('same text');
    expect(iv1).not.toBe(iv2);
  });

  it('outputs valid hex strings', () => {
    const { encrypted, iv, authTag } = encrypt('test data');
    const hexRegex = /^[0-9a-f]+$/;
    expect(encrypted).toMatch(hexRegex);
    expect(iv).toMatch(hexRegex);
    expect(authTag).toMatch(hexRegex);
  });

  it('throws on tampered ciphertext', () => {
    const { encrypted, iv, authTag } = encrypt('secret');
    const tampered = 'ff' + encrypted.slice(2);
    expect(() => decrypt(tampered, iv, authTag)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const { encrypted, iv, authTag } = encrypt('secret');
    const tampered = 'ff' + authTag.slice(2);
    expect(() => decrypt(encrypted, iv, tampered)).toThrow();
  });

  it('throws when ENCRYPTION_SECRET is missing', () => {
    delete process.env.ENCRYPTION_SECRET;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_SECRET environment variable is required');
  });

  it('throws when ENCRYPTION_SECRET has wrong length', () => {
    process.env.ENCRYPTION_SECRET = 'abc123';
    expect(() => encrypt('test')).toThrow('must be exactly 64 hex characters');
  });

  it('throws when ENCRYPTION_SECRET contains non-hex chars', () => {
    process.env.ENCRYPTION_SECRET = 'g'.repeat(64);
    expect(() => encrypt('test')).toThrow('only hexadecimal characters');
  });

  it('rejects placeholder secrets', () => {
    process.env.ENCRYPTION_SECRET = '0'.repeat(64);
    expect(() => encrypt('test')).toThrow('placeholder');
  });
});
