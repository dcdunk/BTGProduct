# Mission Control — Product Requirements Document

## Overview

Mission Control is an internal web application for the Blue Tees Golf product team. It provides a unified dashboard for creating, managing, and interacting with specialized AI agents that automate product management workflows.

**This is an internal tool, not a commercial product.** Optimize for functionality and speed of development over polish and scalability.

### Problem

The product team currently uses Claude, ChatGPT, and other LLM tools in isolation. Each conversation starts from scratch with no shared context about Blue Tees Golf's products, processes, brand, or history. Team members repeat the same context across dozens of conversations weekly. There is no way to create persistent, specialized AI assistants that understand the team's specific workflows and share organizational knowledge.

### Solution

A self-hosted web app where the team can:

1. Create specialized AI agents with persistent identities, system prompts, and context documents
2. Chat with any agent through a unified interface
3. Share a workspace-level context file (`workspace.md`) that all agents inherit automatically
4. Route conversations to different LLM providers (Claude, GPT, Gemini) per agent
5. Allow agents to hand off work to each other through a shared scratchpad

### Users

- Danny (Product Manager) — primary user and admin
- Justin, Drew, Marc, Chris — product team members
- Expected total users: 5-10

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 14+ (App Router) | React ecosystem, SSR, API routes in one project |
| Language | TypeScript | Type safety across frontend and backend |
| Database | SQLite via better-sqlite3 | No separate DB server, file-based, easy backup |
| Auth | NextAuth.js with Google OAuth | Team already uses Google Workspace |
| LLM Providers | Anthropic, OpenAI, Google Gemini | Multi-provider via unified abstraction layer |
| Styling | Tailwind CSS | Rapid UI development |
| Deployment | Local server or Railway/Vercel | Internal tool, low traffic |

---

## Data Model

### Tables

#### `users`
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `agents`
```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  system_prompt TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic', 'openai', 'google')),
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  temperature REAL DEFAULT 0.7,
  context_files TEXT DEFAULT '[]',  -- JSON array of file references
  tools_enabled TEXT DEFAULT '[]',  -- JSON array of tool names
  created_by TEXT NOT NULL REFERENCES users(id),
  is_shared INTEGER DEFAULT 1,  -- visible to all workspace members
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `conversations`
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  active_template_id TEXT REFERENCES templates(id),  -- Currently active template for this conversation
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `messages`
```sql
CREATE TABLE messages (
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
```

#### `context_files`
```sql
CREATE TABLE context_files (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('workspace', 'agent')),
  agent_id TEXT REFERENCES agents(id),  -- NULL if scope = 'workspace'
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `skills`
```sql
CREATE TABLE skills (
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
```

#### `agent_skills`
```sql
CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'on_demand' CHECK (mode IN ('always_on', 'on_demand')),
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, skill_id)
);
```

#### `templates`
```sql
CREATE TABLE templates (
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
```

#### `agent_templates`
```sql
CREATE TABLE agent_templates (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, template_id)
);
```

#### `scratchpad`
```sql
CREATE TABLE scratchpad (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_agent_id TEXT REFERENCES agents(id),
  source_conversation_id TEXT REFERENCES conversations(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Architecture

### LLM Provider Abstraction

Create a unified interface so agents can use any provider without the rest of the app caring which one.

```
src/lib/llm/
├── types.ts          -- Shared types: LLMMessage, LLMResponse, LLMConfig
├── provider.ts       -- Abstract LLMProvider interface
├── anthropic.ts      -- Anthropic implementation (Claude)
├── openai.ts         -- OpenAI implementation (GPT)
├── google.ts         -- Google implementation (Gemini)
└── index.ts          -- Factory: getProvider(providerName) => LLMProvider
```

**LLMProvider interface:**
```typescript
interface LLMProvider {
  chat(config: {
    model: string;
    messages: LLMMessage[];
    systemPrompt: string;
    temperature?: number;
    stream?: boolean;
  }): AsyncIterable<string> | Promise<LLMResponse>;
}
```

Each provider implementation translates the unified interface into provider-specific API calls. The system prompt for any agent call is constructed by concatenating:

1. Workspace-level context (all `context_files` where `scope = 'workspace'`)
2. Agent-specific context (all `context_files` where `agent_id` matches)
3. The agent's `system_prompt`
4. Always-on skill instructions (from `agent_skills` where `mode = 'always_on'`, ordered by `sort_order`)
5. Active template content (if `conversations.active_template_id` is set)
6. On-demand skill instructions (if user invoked `/skill [name]` in current message — this turn only)

This concatenation happens at call time in the API route, not stored in the database.

### System Prompt Assembly Order

When a user sends a message to an agent, the system prompt is assembled in this exact order:

```
[workspace.md content — from context_files where scope='workspace']
---
[Agent-specific context files — from context_files where agent_id matches]
---
[Agent system prompt — from agents.system_prompt]
```

This ensures every agent inherits workspace knowledge, then gets its specialized context, then its behavioral instructions.

### Streaming

All chat responses should stream. Use Server-Sent Events (SSE) from the Next.js API route to the frontend. Each provider SDK supports streaming natively:

- Anthropic: `client.messages.stream()`
- OpenAI: `client.chat.completions.create({ stream: true })`
- Google: `model.generateContentStream()`

### File Structure

```
mission-control/
├── src/
│   ├── app/
│   │   ├── layout.tsx              -- Root layout with auth provider
│   │   ├── page.tsx                -- Dashboard (agent grid)
│   │   ├── login/page.tsx          -- Google OAuth login
│   │   ├── agents/
│   │   │   ├── page.tsx            -- Agent list/management
│   │   │   ├── new/page.tsx        -- Create agent form
│   │   │   └── [slug]/
│   │   │       ├── page.tsx        -- Agent chat interface
│   │   │       ├── edit/page.tsx   -- Edit agent config
│   │   │       └── conversations/page.tsx -- Conversation history
│   │   ├── skills/
│   │   │   ├── page.tsx            -- Skills library
│   │   │   ├── new/page.tsx        -- Create skill form
│   │   │   └── [slug]/edit/page.tsx -- Edit skill
│   │   ├── templates/
│   │   │   ├── page.tsx            -- Templates library
│   │   │   ├── new/page.tsx        -- Create template form
│   │   │   └── [slug]/edit/page.tsx -- Edit template
│   │   ├── scratchpad/page.tsx     -- Shared scratchpad viewer
│   │   ├── settings/
│   │   │   ├── page.tsx            -- Workspace settings
│   │   │   ├── context/page.tsx    -- Workspace context files editor
│   │   │   └── api-keys/page.tsx   -- API key management
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── agents/route.ts
│   │       ├── chat/route.ts       -- SSE streaming endpoint
│   │       ├── conversations/route.ts
│   │       ├── context-files/route.ts
│   │       ├── skills/route.ts
│   │       ├── templates/route.ts
│   │       └── scratchpad/route.ts
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── AgentCard.tsx
│   │   │   └── AgentGrid.tsx
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── ConversationSidebar.tsx
│   │   ├── agents/
│   │   │   ├── AgentForm.tsx
│   │   │   ├── SystemPromptEditor.tsx
│   │   │   └── ContextFileManager.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       └── AuthGuard.tsx
│   ├── lib/
│   │   ├── db.ts                   -- SQLite connection + migrations
│   │   ├── llm/                    -- Provider abstraction (see above)
│   │   └── auth.ts                 -- NextAuth config
│   └── types/
│       └── index.ts                -- Shared TypeScript types
├── data/
│   └── mission-control.db          -- SQLite database file
├── context/
│   └── workspace.md                -- Default workspace context (seeded)
├── claude.md                       -- Claude Code project context
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

---

## Features — Prioritized

### P0 — Must have for v1

**F1: Google OAuth Login**
- Users authenticate with their Google Workspace account
- Only emails from an allowed domain list can access the app (configurable in env vars)
- Session persists via NextAuth.js JWT

**F2: Dashboard**
- Grid view of all agents in the workspace
- Each agent card shows: emoji avatar, name, description, provider badge, last active timestamp
- Click card to open chat with that agent
- "Create Agent" button prominently visible

**F3: Agent Creation & Configuration**
- Form fields: name, description, avatar emoji, system prompt, provider, model, temperature
- System prompt editor with syntax highlighting (use a code editor component like Monaco or CodeMirror)
- Ability to attach context files specific to this agent
- Skills section: assign skills from global library with always-on/on-demand toggle
- Templates section: assign templates from global library
- Provider/model selector dropdown (populated from available providers)
- Save creates the agent and redirects to its chat page

**F4: Chat Interface**
- Full-screen chat view when talking to an agent
- Streaming responses rendered in real-time
- Markdown rendering in messages (code blocks, lists, bold, links)
- Conversation history sidebar listing past conversations with this agent
- "New Conversation" button
- Agent identity visible at top (name, emoji, description)
- Template picker: button to select a template for the conversation from agent's assigned templates
- Skill invoker: button or `/skill` command to activate an on-demand skill for the current message

**F5: Workspace Context (`workspace.md`)**
- A single editable markdown file that provides context to ALL agents
- Edited via Settings > Workspace Context
- Content is prepended to every agent's system prompt at call time
- Seeded with Blue Tees Golf organizational context on first run

**F6: API Key Management**
- Settings page where admin can enter API keys for each provider
- Keys stored encrypted in SQLite (use AES-256 with an env var secret)
- UI shows which providers are configured and active
- Non-admin users cannot view or edit keys

**F7: Skills Library**
- Global list view of all skills at `/skills`
- Create/edit/delete skills with name, description, emoji, category, content (markdown editor)
- Skills are assigned to agents via agent configuration
- Two modes: always-on (included in every conversation) and on-demand (user invokes explicitly)
- Full spec in `SKILLS_AND_TEMPLATES.md`

**F8: Templates Library**
- Global list view of all templates at `/templates`
- Create/edit/delete templates with name, description, emoji, category, format, content
- Markdown format for v1, structured schema support planned for future
- Templates assigned to agents, invoked during chat by user selection or agent suggestion
- Full spec in `SKILLS_AND_TEMPLATES.md`

### P1 — Important for usability

**F9: Scratchpad (Agent-to-Agent Handoff)**
- Any agent conversation can "Save to Scratchpad" — saves a selected message or conversation summary
- Scratchpad items are viewable by all users and can be "sent" to another agent as context
- When opening a new conversation, user can optionally attach scratchpad items
- This is the v1 mechanism for agent-to-agent communication (human-in-the-loop)

**F10: Conversation Search**
- Search across all conversations by keyword
- Filter by agent, date range, user
- Results show message snippets with highlights

**F11: Agent Duplication**
- "Duplicate" button on agent config page
- Creates a copy with "(Copy)" appended to name
- Useful for creating variations of a working agent

**F12: Conversation Export**
- Export any conversation as Markdown
- Export as JSON (for potential import later)

### P2 — Nice to have

**F13: Agent-to-Agent Direct Communication**
- An agent can invoke another agent within a conversation
- Syntax: user types `/ask @agent-name [question]` or the agent itself can reference another agent
- The system routes the question, gets a response, and includes it in the current conversation
- This is more complex and should only be built after P0 and P1 are solid

**F14: Usage Analytics**
- Track tokens consumed per agent, per user, per provider
- Simple dashboard showing costs and usage trends
- Uses data already captured in the `messages` table (tokens_in, tokens_out)

**F15: Dark Mode**
- Toggle between light and dark themes
- Persist preference per user

---

## Agent Starter Pack

The following agents should be pre-configured when the workspace is first created. Their full definitions (system prompts, context files) are in the companion document `AGENT_DEFINITIONS.md`. Starter skills, templates, and agent-skill-template assignments are defined in `SKILLS_AND_TEMPLATES.md`.

1. **PRD Drafter** — Generates product requirements documents following Blue Tees NPD process
2. **Competitive Intel** — Researches and analyzes the golf technology competitive landscape
3. **Brand Voice** — Writes copy and reviews content for Blue Tees brand consistency
4. **Tech Spec Writer** — Creates hardware/software technical specifications
5. **QA Reviewer** — Reviews deliverables against quality gate criteria

---

## Environment Variables

```env
# Auth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=           # Random string for JWT signing
NEXTAUTH_URL=              # e.g., http://localhost:3000
ALLOWED_EMAIL_DOMAIN=      # e.g., blueteesgolf.com

# LLM Providers (at least one required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=

# Encryption
ENCRYPTION_SECRET=         # 32-byte hex string for API key encryption at rest

# Database
DATABASE_PATH=./data/mission-control.db
```

---

## Non-Functional Requirements

- **Latency**: Chat responses should begin streaming within 2 seconds of sending a message
- **Concurrency**: Must handle 5 simultaneous users without degradation (SQLite WAL mode)
- **Data**: All data stays local (SQLite file). No external analytics or telemetry
- **Backup**: SQLite file can be backed up by copying the `.db` file
- **Security**: API keys encrypted at rest. Google OAuth restricts access to allowed domains

---

## Out of Scope for v1

- Mobile-responsive design (desktop only is fine)
- File upload in chat (can be added later)
- Voice input
- Plugin/extension system
- Multi-workspace (single workspace only)
- RAG / vector search over documents
- Automated agent workflows without human approval
