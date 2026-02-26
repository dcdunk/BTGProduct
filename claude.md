# Mission Control — Claude Code Project Context

## What is this project?

Mission Control is an internal web app for the Blue Tees Golf product team. It's a dashboard for creating and managing specialized AI agents that help with product management workflows. Think of it as a self-hosted, team-shared AI assistant hub where each agent has a specific role (PRD writing, competitive research, brand copy, etc.).

## Tech Stack

- **Framework**: Next.js 14+ with App Router, TypeScript
- **Database**: SQLite via `better-sqlite3` (file at `./data/mission-control.db`)
- **Auth**: NextAuth.js with Google OAuth provider
- **LLM Providers**: Anthropic (Claude), OpenAI (GPT), Google (Gemini) — abstracted behind a unified provider interface in `src/lib/llm/`
- **Styling**: Tailwind CSS
- **Streaming**: Server-Sent Events (SSE) for chat responses

## Key Architecture Decisions

1. **SQLite, not Postgres.** This is an internal tool for 5-10 users. SQLite in WAL mode is plenty. The database file lives at `./data/mission-control.db`. Don't add connection pooling or migration tools — use raw SQL in `src/lib/db.ts`.

2. **LLM Provider Abstraction.** All LLM calls go through the interface in `src/lib/llm/provider.ts`. Each provider (Anthropic, OpenAI, Google) has its own implementation file. When adding a new provider, create a new file in `src/lib/llm/` and register it in `src/lib/llm/index.ts`. Never call provider SDKs directly from API routes.

3. **System Prompt Assembly.** When a chat message is sent, the system prompt is built by concatenating in this order:
   - Workspace context files (scope = 'workspace' from the `context_files` table)
   - Agent-specific context files (matching `agent_id`)
   - The agent's `system_prompt` field
   - Always-on skill instructions (from `agent_skills` where `mode = 'always_on'`, ordered by `sort_order`)
   - Active template content (if `conversations.active_template_id` is set)
   - On-demand skill content (if user invoked `/skill [name]` in current message — single turn only)
   This happens in the `/api/chat` route handler. Don't cache assembled prompts — always build fresh from DB. Steps 4-6 are conditional.

4. **Streaming responses.** All chat endpoints return SSE streams. Use the native streaming support from each provider SDK. The frontend consumes these via `EventSource` or `fetch` with a readable stream.

5. **Encrypted API keys.** Provider API keys entered via the settings UI are encrypted with AES-256-GCM before storing in SQLite. The encryption/decryption logic lives in `src/lib/crypto.ts` (NOT `src/lib/auth.ts`). The encryption key comes from `ENCRYPTION_SECRET` env var (must be 64-char hex / 32 bytes). See `SECURITY_AUDIT.md` for the full encryption spec, key resolution order, and security checklist.

6. **Server-only enforcement.** All files in `src/lib/llm/` and `src/lib/crypto.ts` must have `import 'server-only'` at the top. These files must NEVER be imported by client components. This prevents API keys from leaking into the browser bundle.

7. **Logging policy.** NEVER log API keys (plaintext or encrypted). NEVER log full request bodies for `/api/settings/api-keys` routes. Sanitize all LLM provider error messages before logging or returning to the client — use the sanitizer in `src/lib/sanitize.ts` to redact key patterns.

## Coding Conventions

- Use TypeScript strict mode. No `any` types unless absolutely necessary.
- Server Components by default. Use `'use client'` only for interactive components.
- API routes in `src/app/api/` use Route Handlers (not Pages Router API routes).
- Database queries go through helper functions in `src/lib/db.ts`, not inline in routes.
- Error handling: API routes return proper HTTP status codes with JSON error bodies. Don't swallow errors silently.
- No ORMs. Write raw SQL. The schema is simple enough that an ORM adds complexity without value.

## Visual Design

- **All visual decisions are in `DESIGN_SYSTEM.md`.** Read it before writing any UI code.
- Colors, typography, component patterns, animations, and atmospheric effects are fully specified there.
- Use CSS custom properties defined in `src/app/globals.css` (dark and light theme blocks).
- Reference colors via Tailwind extended theme (e.g., `bg-void`, `text-cyan`, `border-subtle`, `font-display`).
- Dark mode is primary. Light mode is the alternative. Use `data-theme` attribute on `<html>`, not Tailwind's `dark:` prefix.
- Glow effects on hover (box-shadow with neon colors) are the signature interaction. Apply to cards, focused inputs, and primary buttons.
- All label/button/badge/nav text is uppercase monospace (JetBrains Mono). Body text in messages and long-form content stays normal case.
- Import Orbitron (500, 700) and JetBrains Mono (400, 500, 700) via `next/font/google`.

## File Structure Overview

```
src/app/          — Pages and API routes (App Router)
src/components/   — React components organized by feature
src/lib/          — Core logic: database, LLM providers, auth
src/types/        — Shared TypeScript interfaces
data/             — SQLite database file (gitignored)
context/          — Default workspace context files (seeded on first run)
```

## Common Tasks

### Adding a new LLM provider
1. Create `src/lib/llm/{provider}.ts` implementing `LLMProvider` interface
2. Add provider name to the `provider` CHECK constraint in the `agents` table
3. Register in `src/lib/llm/index.ts` factory function
4. Add model options to the agent creation form dropdown

### Adding a new agent to the starter pack
1. Add agent definition to `context/seed-agents.json`
2. Add any agent-specific context files to `context/agents/{agent-slug}/`
3. Add skill and template assignments to `context/seed-assignments.json`
4. The seed script in `src/lib/db.ts` will create them on first run

### Adding a new skill to the library
1. Add skill definition to `context/seed-skills.json`
2. The seed script creates it on first run
3. To assign to agents, update `context/seed-assignments.json`

### Adding a new template to the library
1. Add template definition to `context/seed-templates.json`
2. The seed script creates it on first run
3. To assign to agents, update `context/seed-assignments.json`

### Modifying the database schema
1. Update the CREATE TABLE statements in `src/lib/db.ts`
2. For existing databases, write a migration function that runs on startup
3. Bump the schema version number in the migrations array

## What NOT to do

- Don't add a separate backend service. Everything runs in Next.js API routes.
- Don't use Prisma, Drizzle, or any ORM. Raw SQL with better-sqlite3.
- Don't create separate CSS files. Use Tailwind utility classes inline.
- Don't add WebSocket support. SSE is sufficient for streaming.
- Don't implement multi-tenancy or workspace switching. Single workspace only.
- Don't add file upload to chat in v1. Text-only conversations.
- Don't build automated agent-to-agent communication. Use the scratchpad for manual handoff.
