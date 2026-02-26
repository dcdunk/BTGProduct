# Mission Control — Security Audit: API Key Protection

This document audits every path through which LLM provider API keys (Anthropic, OpenAI, Google) could be exposed, and specifies the mitigations required. Claude Code must implement all items marked **REQUIRED**.

---

## API Key Lifecycle

An API key touches the system at these points:

```
1. User types key into browser form → 
2. Key sent over HTTP to API route →
3. API route encrypts key → 
4. Encrypted key stored in SQLite →
5. On chat request, key decrypted in memory →
6. Key passed to LLM provider SDK →
7. Key exists in server process memory during request →
8. Key potentially visible in logs, error messages, stack traces
```

Every step is an exposure surface. Here's the audit for each.

---

## VULNERABILITY 1: No dedicated API key storage table

**Current state:** The docs reference encrypted API keys but never define a database table for them. The env vars section lists `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY` as environment variables, AND the UI has a settings page for entering keys. This is contradictory — are keys in env vars or in the database?

**Risk:** If a developer follows the env var approach, keys sit in plaintext in `.env` files, shell history, deployment configs, and process environment. If they follow the database approach, there's no table defined.

**REQUIRED FIX:** Support both approaches, with database-stored keys taking priority.

### Add `api_keys` table:

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT UNIQUE NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  encrypted_key TEXT NOT NULL,        -- AES-256-GCM encrypted
  iv TEXT NOT NULL,                    -- Initialization vector (hex)
  auth_tag TEXT NOT NULL,              -- GCM authentication tag (hex)
  key_hint TEXT NOT NULL,              -- Last 4 characters of plaintext key (for UI display)
  set_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Key resolution order:
```typescript
function getApiKey(provider: string): string | null {
  // 1. Check database first (user-entered keys via Settings UI)
  const dbKey = db.prepare('SELECT * FROM api_keys WHERE provider = ?').get(provider);
  if (dbKey) return decrypt(dbKey);

  // 2. Fall back to environment variables
  const envMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
  };
  return process.env[envMap[provider]] || null;
}
```

### Remove env var API keys from required config:
The environment variables `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY` become **optional fallbacks**, not the primary mechanism. The Settings UI is the primary way to enter keys.

---

## VULNERABILITY 2: Encryption spec is too vague

**Current state:** PRD says "AES-256 with an env var secret." Claude.md says "AES-256" and references `src/lib/auth.ts`. No spec for cipher mode, IV handling, key derivation, or authentication.

**Risk:** A developer might use AES-256-ECB (no IV, deterministic, broken for this use case) or AES-256-CBC without HMAC (vulnerable to padding oracle attacks). Without an authentication tag, encrypted data can be tampered with.

**REQUIRED FIX:** Specify AES-256-GCM explicitly, with proper IV handling.

### Encryption implementation:

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;        // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16;  // 128-bit auth tag

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      'ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32'
    );
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

export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Why AES-256-GCM:
- **Authenticated encryption**: The auth tag prevents tampering with the ciphertext. If someone modifies the encrypted key in the database, decryption fails cleanly.
- **Non-deterministic**: Random IV means encrypting the same key twice produces different ciphertext.
- **Standard**: Node.js `crypto` module supports it natively. No third-party dependencies.

### Why NOT `src/lib/auth.ts`:
Claude.md says encryption lives in `src/lib/auth.ts`. This is wrong — auth handles OAuth sessions. Encryption is a separate concern.

**REQUIRED:** Move encryption to `src/lib/crypto.ts`. Don't mix auth logic with crypto logic.

---

## VULNERABILITY 3: API keys exposed in API responses

**Current state:** No spec for what the GET endpoint for API keys returns. If a developer builds a standard REST endpoint, it might return the encrypted key (or worse, the decrypted key) in the response body.

**Risk:** Any authenticated user (not just admins) could hit the GET endpoint and see keys. Even returning encrypted ciphertext is information leakage.

**REQUIRED FIX:** The API key endpoints must NEVER return the actual key or encrypted key.

### GET `/api/settings/api-keys` response:

```typescript
// CORRECT — only return metadata, never the key
{
  providers: [
    {
      provider: "anthropic",
      configured: true,        // has a key been set?
      hint: "...sk4f",         // last 4 chars only
      source: "database",      // "database" or "environment"
      set_by: "Danny",         // who set it (database keys only)
      updated_at: "2026-02-19T..."
    },
    {
      provider: "openai",
      configured: false,
      hint: null,
      source: null,
      set_by: null,
      updated_at: null
    },
    {
      provider: "google",
      configured: true,
      hint: "...8xQ2",
      source: "environment",   // env var keys show source but no set_by
      set_by: null,
      updated_at: null
    }
  ]
}
```

### POST `/api/settings/api-keys` — setting a key:

```typescript
// Request
{ provider: "anthropic", api_key: "sk-ant-api03-..." }

// Response — NO key echoed back
{ success: true, provider: "anthropic", hint: "...3abc" }
```

### DELETE `/api/settings/api-keys/[provider]` — removing a key:

```typescript
// Response
{ success: true, provider: "anthropic" }
```

**The plaintext API key must NEVER appear in any API response. Not encrypted, not hashed, not partially masked beyond the last 4 characters.**

---

## VULNERABILITY 4: API keys exposed in browser network tab

**Current state:** When a user enters a key on the Settings page and clicks Save, the key is sent as a POST body to the API route. This is visible in the browser's Network tab in DevTools.

**Risk:** Low for an internal tool, but it's a potential issue if someone screenshots their browser or if an attacker has access to the machine.

**MITIGATIONS (REQUIRED):**

1. **HTTPS in production.** If deployed to Railway/Vercel, this is automatic. If running on a local network, configure a reverse proxy (nginx/Caddy) with a self-signed cert, or accept the risk for local-only deployments. Document this.

2. **Clear the input field immediately after submission.** Don't leave the plaintext key sitting in the form.

3. **No autocomplete on the API key input:**
```html
<input type="password" autocomplete="off" data-1p-ignore data-lpignore="true" />
```
The `type="password"` masks the input visually. `data-1p-ignore` and `data-lpignore` prevent password managers from storing it.

4. **POST request body is ephemeral.** After the route handler encrypts and stores the key, there's no persistence of the plaintext in server memory beyond the request lifecycle. Node.js garbage collection handles this. For extra safety, overwrite the variable:
```typescript
let apiKey = requestBody.api_key;
// ... encrypt and store ...
apiKey = ''; // clear from memory
```

---

## VULNERABILITY 5: API keys in server logs

**Current state:** No logging policy is defined. If a developer adds request logging (common in development), API keys could end up in log files.

**Risk:** Log files are often less protected than databases. They end up in deployment platform dashboards, error reporting tools, and CI/CD outputs.

**REQUIRED FIX:** Add explicit logging rules to `claude.md`:

```
## Logging Policy

- NEVER log API keys, encrypted or plaintext, in any log output.
- NEVER log full request bodies for the `/api/settings/api-keys` route.
- NEVER include API keys in error messages sent to the client.
- If a provider SDK throws an error that includes the API key in the error message, 
  sanitize it before logging or displaying: replace any string matching 
  common key patterns (sk-ant-*, sk-*, AIza*) with "[REDACTED]".
- Log file location: Do NOT write log files to the `data/` directory 
  (where the SQLite database lives). Use stdout/stderr only.
```

### Key sanitization helper:

```typescript
// src/lib/sanitize.ts
const KEY_PATTERNS = [
  /sk-ant-api\S+/g,         // Anthropic keys
  /sk-proj-\S+/g,           // OpenAI project keys
  /sk-\S{20,}/g,            // OpenAI legacy keys
  /AIza\S{30,}/g,           // Google AI keys
];

export function sanitizeForLog(text: string): string {
  let result = text;
  for (const pattern of KEY_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_API_KEY]');
  }
  return result;
}
```

Apply this sanitizer to any error messages before: logging to console, returning to the client, or storing in the database.

---

## VULNERABILITY 6: API keys exposed via LLM provider error responses

**Current state:** When making API calls to Anthropic/OpenAI/Google, if the key is invalid or the request fails, some provider SDKs include the API key in the error object or error message.

**Risk:** The error gets displayed in the chat UI ("Error: Invalid API key sk-ant-api03-...") or logged to console.

**REQUIRED FIX:** In each LLM provider implementation, wrap all API calls in try/catch and sanitize errors:

```typescript
// src/lib/llm/anthropic.ts
try {
  const stream = await client.messages.stream({...});
  // ...
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  // NEVER pass raw error to client
  throw new LLMError(sanitizeForLog(message), provider, model);
}
```

The `LLMError` class should only expose a user-safe message. The raw error (with potential key content) should only be logged server-side after sanitization.

---

## VULNERABILITY 7: API keys accessible to non-admin users

**Current state:** PRD F6 says "Non-admin users cannot view or edit keys." But there's no spec for how this authorization check works at the API level.

**Risk:** A member-role user could directly call the API endpoints (`POST /api/settings/api-keys`) and set or overwrite keys.

**REQUIRED FIX:** All `/api/settings/api-keys/*` routes must check authorization:

```typescript
// In every api-keys route handler
const session = await getServerSession(authOptions);
if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

const user = getUserByEmail(session.user.email);
if (user.role !== 'admin') {
  return Response.json({ error: 'Admin access required' }, { status: 403 });
}
```

The UI should also hide the API Keys settings tab for non-admin users, but the API-level check is the real security boundary. UI hiding is cosmetic.

---

## VULNERABILITY 8: ENCRYPTION_SECRET is weak or missing

**Current state:** The env var is documented as "32-byte hex string" but there's no validation at startup.

**Risk:** If the secret is too short, empty, or a common value, encryption is effectively useless.

**REQUIRED FIX:** Validate at app startup (in `src/lib/crypto.ts` or the root layout):

```typescript
function validateEncryptionSecret(): void {
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
  
  // Reject obviously weak secrets
  if (secret === '0'.repeat(64) || secret === 'a'.repeat(64)) {
    throw new Error('ENCRYPTION_SECRET appears to be a placeholder. Generate a real one with: openssl rand -hex 32');
  }
}
```

Call this once at app startup. If it fails, the app should refuse to start (not silently continue with broken encryption).

---

## VULNERABILITY 9: SQLite database file contains encrypted keys — but file itself is unprotected

**Current state:** The database lives at `./data/mission-control.db`. Anyone with file system access can read it, and while the keys are encrypted, the encryption is only as strong as the `ENCRYPTION_SECRET`.

**Risk:** If someone copies the `.db` file AND the `.env` file (or the deployment config with the secret), they can decrypt all keys.

**MITIGATIONS (REQUIRED):**

1. **`.gitignore` must include both:**
```
data/
.env
.env.local
.env.production
```

2. **README setup instructions must warn:**
```
⚠️ SECURITY: Never commit the `data/` directory or `.env` files to version control. 
The database contains encrypted API keys. The .env file contains the encryption secret. 
Together, they reveal your plaintext API keys.
```

3. **File permissions (if on Linux/Mac server):**
```bash
chmod 600 ./data/mission-control.db
chmod 600 .env
```

4. **Backup awareness:** Document that backups of the `.db` file should be treated as sensitive. If backing up to cloud storage, ensure it's encrypted at rest.

---

## VULNERABILITY 10: API keys passed to LLM providers in memory — no additional risk

**Current state:** When making an API call, the key is decrypted in memory, passed to the provider SDK, and used for the HTTP request.

**Assessment:** This is unavoidable. The key must be plaintext to authenticate with the provider. The mitigation is that decryption only happens in the server-side API route handler, never in client-side code.

**VERIFY:** Confirm that LLM provider calls ONLY happen in:
- `src/lib/llm/anthropic.ts`
- `src/lib/llm/openai.ts`
- `src/lib/llm/google.ts`

These files should ONLY be imported by server-side code (`src/app/api/` routes). They must NEVER be imported by any `'use client'` component. Next.js App Router enforces this if the files don't have `'use client'` at the top, but be explicit:

```typescript
// src/lib/llm/anthropic.ts
// @server-only — this file must never be bundled for the client
import 'server-only'; // Next.js package that throws at build time if imported client-side
```

**REQUIRED:** Add `import 'server-only'` to the top of every file in `src/lib/llm/` and `src/lib/crypto.ts`. Install the `server-only` package.

---

## VULNERABILITY 11: Environment variable API keys visible in process listing

**Current state:** If API keys are provided via env vars (the fallback mechanism), they're visible to any process on the same machine via `/proc/[pid]/environ` on Linux or `ps eww` on Mac.

**Risk:** Low for a single-user machine. Medium if deployed to a shared server.

**MITIGATION:** Document that the Settings UI (database storage) is preferred over env vars. Env vars are a convenience for initial setup only. Once keys are entered via the UI, the env var values can be removed.

---

## VULNERABILITY 12: No rate limiting on API key endpoints

**Current state:** Nothing prevents an attacker (or a bug) from hammering the API key test endpoint.

**Risk:** Each test makes a real API call to the provider. An attacker could trigger many test calls, consuming rate limits or racking up micro-charges.

**REQUIRED FIX:** Rate limit the test endpoint:

```typescript
// Simple in-memory rate limiter for the test endpoint
const testAttempts = new Map<string, { count: number; resetAt: number }>();

function checkTestRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = testAttempts.get(userId);
  
  if (!entry || now > entry.resetAt) {
    testAttempts.set(userId, { count: 1, resetAt: now + 60_000 }); // 1 minute window
    return true;
  }
  
  if (entry.count >= 5) return false; // Max 5 tests per minute
  entry.count++;
  return true;
}
```

---

## Summary: Security Checklist

| # | Requirement | Priority |
|---|-------------|----------|
| 1 | Add `api_keys` table with IV and auth tag columns | CRITICAL |
| 2 | Use AES-256-GCM with random IV, store auth tag | CRITICAL |
| 3 | API key GET endpoint returns only `configured`, `hint`, `source` — never the key | CRITICAL |
| 4 | API key POST/DELETE restricted to admin role at API level | CRITICAL |
| 5 | `import 'server-only'` on all LLM provider files and crypto.ts | CRITICAL |
| 6 | Validate ENCRYPTION_SECRET format and strength at startup | CRITICAL |
| 7 | Sanitize all LLM provider errors before logging or returning to client | HIGH |
| 8 | No-logging policy for API key routes | HIGH |
| 9 | `type="password"` + autocomplete off + password manager ignore on key input | HIGH |
| 10 | `.gitignore` includes `data/` and all `.env` files | HIGH |
| 11 | Clear plaintext key from memory after encryption | MEDIUM |
| 12 | Rate limit on test connection endpoint (5/min/user) | MEDIUM |
| 13 | HTTPS documentation for production deployment | MEDIUM |
| 14 | File permission guidance for `.db` and `.env` files | LOW |
| 15 | Backup security documentation | LOW |

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/lib/crypto.ts` | NEW — AES-256-GCM encrypt/decrypt + ENCRYPTION_SECRET validation |
| `src/lib/sanitize.ts` | NEW — API key pattern sanitizer for logs/errors |
| `src/lib/llm/*.ts` | MODIFY — Add `import 'server-only'`, wrap errors in sanitizer |
| `src/app/api/settings/api-keys/route.ts` | NEW — Admin-only CRUD, never return key values |
| `src/app/api/settings/api-keys/test/route.ts` | NEW — Rate-limited connection test |
| `src/lib/db.ts` | MODIFY — Add `api_keys` table to schema, add key resolution function |
| `claude.md` | MODIFY — Add logging policy, reference crypto.ts instead of auth.ts |
| `.gitignore` | MODIFY — Ensure `data/` and `.env*` patterns present |
| `package.json` | MODIFY — Add `server-only` package |
