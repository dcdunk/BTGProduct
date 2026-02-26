import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error(
      'ENCRYPTION_SECRET environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (secret.length !== 64) {
    throw new Error(
      `ENCRYPTION_SECRET must be exactly 64 hex characters (32 bytes). Got ${secret.length} characters.`
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(secret)) {
    throw new Error('ENCRYPTION_SECRET must contain only hexadecimal characters (0-9, a-f).');
  }

  if (secret === '0'.repeat(64) || secret === 'a'.repeat(64)) {
    throw new Error('ENCRYPTION_SECRET appears to be a placeholder. Generate a real one with: openssl rand -hex 32');
  }

  return Buffer.from(secret, 'hex');
}

export function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decrypt(encryptedHex: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
