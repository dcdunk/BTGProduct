# Mission Control — Documentation Index

## For Claude Code

This folder contains the complete specification for building Mission Control, an internal AI agent management dashboard. Read these documents in this order:

1. **`PRD.md`** — Product requirements, tech stack, data model, architecture, feature list, and file structure. This is your primary reference. Start here.

2. **`claude.md`** — Copy this file into the project root. It provides persistent context for Claude Code across coding sessions. Contains architecture decisions, coding conventions, and "what not to do" guardrails.

3. **`AGENT_DEFINITIONS.md`** — Full specifications for 5 starter agents including system prompts and context files. These become seed data that populates the app on first run.

4. **`UI_SPEC.md`** — Screen-by-screen interface specification with layout diagrams, component descriptions, and interaction behaviors. References the design system for all visual details.

5. **`DESIGN_SYSTEM.md`** — Complete visual design language: cyberpunk-inspired color system (dark + light mode), typography (Orbitron + JetBrains Mono), component patterns with CSS, atmospheric effects, animations, Tailwind config, and implementation notes. This is the definitive reference for all visual decisions.

6. **`SKILLS_AND_TEMPLATES.md`** — Addendum covering the Skills (reusable capability modules) and Templates (structured output formats) systems. Includes database schema additions, updated system prompt assembly order, UI additions, seed data for 4 starter skills and 3 starter templates, and agent-skill-template assignments.

7. **`workspace-seed.md`** — Default content for the workspace context file. Copy this to `context/workspace.md` in the project. It provides Blue Tees Golf organizational knowledge to all agents.

8. **`IMPLEMENTATION_DETAILS.md`** — **READ THIS LAST BEFORE SECURITY.** Gap analysis and fixes covering: contradictions between documents (with resolutions), missing navigation/routing specs, empty states for every screen, error and edge case handling, missing technical specs (markdown renderer, code editor, slug generation, token estimation), API route request/response formats, database indexes, confirmation dialogs, toast notifications, keyboard shortcuts, and corrected schema. If this document contradicts another document, this document wins.

9. **`SECURITY_AUDIT.md`** — **READ THIS AFTER EVERYTHING ELSE. SECURITY REQUIREMENTS OVERRIDE ALL OTHER DOCS.** Comprehensive audit of API key handling across every touchpoint: storage, encryption (AES-256-GCM spec with code), API response sanitization, access control, logging policy, error sanitization, rate limiting, and a 15-item security checklist. Defines the `api_keys` table, `src/lib/crypto.ts`, and `src/lib/sanitize.ts`.

## Build Order Recommendation

Phase 1 (core):
- Project scaffolding (Next.js, TypeScript, Tailwind)
- SQLite database setup with schema from PRD
- Google OAuth authentication
- Dashboard page with agent cards

Phase 2 (chat):
- LLM provider abstraction layer (Anthropic first, then OpenAI, then Google)
- Chat API route with SSE streaming
- Chat interface component with Markdown rendering
- Conversation persistence

Phase 3 (configuration):
- Agent creation/editing form
- Skills library (CRUD + assign to agents)
- Templates library (CRUD + assign to agents)
- Workspace context editor
- API key management (with encryption)
- Agent seeding from AGENT_DEFINITIONS.md
- Skill/template seeding from SKILLS_AND_TEMPLATES.md

Phase 4 (collaboration):
- Scratchpad (save from chat, send to agent)
- Template picker in chat interface
- Skill invocation in chat (`/skill` command or button)
- Conversation search
- Agent duplication
- Conversation export

## Key Decisions Already Made

- SQLite (not Postgres) — internal tool, 5-10 users
- No ORM — raw SQL via better-sqlite3
- SSE streaming (not WebSocket)
- Single workspace (no multi-tenancy)
- Desktop only (no responsive/mobile)
- Human-in-the-loop agent handoff via scratchpad (no automated agent-to-agent communication in v1)
