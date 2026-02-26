# Mission Control — Implementation Details & Gap Fixes

This document addresses gaps, contradictions, ambiguities, and missing specifications found during a full audit of the document set. Claude Code should read this AFTER the main documents but treat it as authoritative — if this document contradicts something in another doc, this document wins.

---

## 1. Contradictions to Resolve

### 1a. System Prompt Assembly is documented in two places with different content

**PRD.md** has a 6-step assembly order (lines 226-231) AND a 3-step version (lines 239-245) in the "System Prompt Assembly Order" subsection. The 3-step version is outdated and missing skills/templates.

**Fix:** Delete the 3-step version. The correct assembly order is the 6-step version:
1. Workspace context files
2. Agent-specific context files
3. Agent system prompt
4. Always-on skills (ordered by sort_order)
5. Active template (if set on conversation)
6. On-demand skill (if invoked for current message)

### 1b. PRD F15 lists "Dark Mode" as P2 — but DESIGN_SYSTEM.md defines it as a core feature

Dark/light theme toggle is part of the design system and is referenced in the prototype and claude.md. It should not be P2.

**Fix:** Move theme toggle to P0. It's part of the core UI, not an afterthought. The DESIGN_SYSTEM.md already fully specifies both themes.

### 1c. UI_SPEC says "blue background" for user messages — DESIGN_SYSTEM says cyan-muted

UI_SPEC line 132: "User messages: right-aligned, blue background, white text" conflicts with DESIGN_SYSTEM which specifies `var(--accent-cyan-muted)` background with `var(--text-primary)` text.

**Fix:** DESIGN_SYSTEM.md is authoritative. User messages use `--accent-cyan-muted` background with `--text-primary` text, not "blue with white text."

### 1d. UI_SPEC says "white background" for agent messages — DESIGN_SYSTEM says bg-elevated

UI_SPEC line 133: "Agent messages: left-aligned, white background, dark text" conflicts with DESIGN_SYSTEM's dark-first approach.

**Fix:** Agent messages use `--bg-elevated` background with `--text-primary` text.

### 1e. Header is described differently in UI_SPEC vs prototype

UI_SPEC shows a separate header bar above the sidebar. The prototype and DESIGN_SYSTEM put the wordmark inside the sidebar top area with user/theme toggle at the sidebar bottom.

**Fix:** Use the sidebar-integrated approach (no separate header bar). The wordmark sits at the top of the sidebar. User avatar and theme toggle sit at the bottom of the sidebar. This saves vertical space and feels more immersive.

### 1f. `agents` table has `context_files` JSON column AND a separate `context_files` table

The `agents` table (PRD line 74) has `context_files TEXT DEFAULT '[]'` which is a JSON array. But there's also a dedicated `context_files` table (PRD line 111-122) with proper relational structure.

**Fix:** Remove the `context_files` column from the `agents` table. Use only the `context_files` table with `scope='agent'` and `agent_id` set. The JSON column is redundant and will cause confusion about which is the source of truth.

### 1g. `agents` table has `tools_enabled` column that nothing references

The `agents` table (PRD line 75) has `tools_enabled TEXT DEFAULT '[]'` but no feature, UI spec, or document ever mentions tool enablement for agents.

**Fix:** Remove the `tools_enabled` column from the `agents` table. It's dead schema. If tool use is added later, it can be added then.

---

## 2. Missing Navigation & Routing

These are the "click something and nothing happens" issues.

### 2a. No route defined for `/agents` (agent list/management page)

The file structure shows `src/app/agents/page.tsx` but there's no screen spec for it. The sidebar has "Agents" which should link somewhere. Currently clicking "Agents" in the sidebar has no defined destination.

**Fix:** `/agents` shows a list/table view of all agents with columns: Avatar, Name, Provider, Skills count, Templates count, Last Active, Created By. Each row is clickable → navigates to `/agents/[slug]` (chat view). An "Edit" icon button on each row navigates to `/agents/[slug]/edit`. A "+ New Agent" button at the top navigates to `/agents/new`. This is distinct from the Dashboard grid (which is the card-based quick-access view).

### 2b. No route for individual skill or template viewing

Skills and templates have `/skills` and `/templates` list pages, and `new` and `[slug]/edit` pages. But there's no read-only view page for a skill or template. If someone clicks a skill card, where do they go?

**Fix:** Clicking a skill or template card navigates to the edit page (`/skills/[slug]/edit` or `/templates/[slug]/edit`). There's no separate read-only view — edit IS the detail view. This is simpler and appropriate for an internal tool where everyone can edit.

### 2c. Conversation title auto-generation is mentioned but not specified

UI_SPEC says conversation titles are "auto-generated (from first user message)" but doesn't specify how.

**Fix:** When a conversation is created, `title` is NULL. After the first user message is sent, set the title to the first 60 characters of the user's message, trimmed at a word boundary, with "..." appended if truncated. Example: "I need a PRD for a new portable launch monitor..." This happens in the `/api/chat` route when processing the first message of a conversation.

### 2d. "Save to Scratchpad" button behavior is vague

The chat UI says agents messages have a "Save to Scratchpad" button on hover, but doesn't specify what happens when clicked.

**Fix:** Clicking "Save to Scratchpad" on a message opens a small modal/popover with:
- Pre-filled title (first 60 chars of message content)
- Editable title field
- "Save" and "Cancel" buttons
Saving creates a scratchpad entry with the full message content, source_agent_id, source_conversation_id, and the current user as created_by.

### 2e. Scratchpad "New Item" button has no spec

Scratchpad page shows a `[+ New Item]` button but there's no spec for manually creating scratchpad items (vs saving from chat).

**Fix:** Clicking "+ New Item" opens a form/modal with:
- Title (text input, required)
- Content (markdown editor, required)
- source_agent_id and source_conversation_id are NULL for manually created items
No category or tagging needed for v1.

### 2f. Settings page has no default landing

`/settings` exists but no spec for what shows first. The sub-navigation has API Keys, Workspace Context, and Team.

**Fix:** `/settings` redirects to `/settings/api-keys` (the most common settings task). Alternatively, render the API Keys page at `/settings` with tab navigation at the top.

### 2g. Agent creation form: what happens after "Cancel"?

Cancel is described as "returns to previous page" — but if someone navigated directly to `/agents/new`, there's no previous page.

**Fix:** Cancel navigates to `/agents` (agent list). If coming from the dashboard, the browser back behavior already handles returning there, but the explicit Cancel action always goes to `/agents`.

---

## 3. Missing Empty States

AI builders often forget to specify what screens look like when there's no data.

### 3a. Dashboard with no agents

If all seed agents are deleted or on first load before seeding completes.

**Fix:** Show a centered empty state:
- Illustration or icon (a robot emoji or similar)
- Heading: "No agents yet"
- Subtext: "Create your first AI agent to get started."
- Primary button: "+ CREATE AGENT"

### 3b. Chat view with no conversations

When navigating to an agent that has no conversation history.

**Fix:** Auto-create a new conversation and show an empty chat with a centered prompt:
- Agent emoji (large)
- "Start a conversation with [Agent Name]"
- Subtext showing the agent's description
- Message input is active and ready

### 3c. Skills library with no skills

**Fix:** Centered empty state: "No skills yet. Skills are reusable instruction sets that give agents specific capabilities." + "+ CREATE SKILL" button.

### 3d. Templates library with no templates

**Fix:** Same pattern: "No templates yet. Templates define structured output formats for agent deliverables." + "+ CREATE TEMPLATE" button.

### 3e. Scratchpad with no items

**Fix:** "Nothing in the scratchpad yet. Save messages from chat conversations or create items manually." + "+ NEW ITEM" button.

### 3f. Conversation sidebar with no past conversations

When viewing an agent's chat and there's only the current (new) conversation.

**Fix:** Show the current conversation in the sidebar. Below it, subtle text: "This is your first conversation with [Agent Name]."

### 3g. Agent edit form: Skills/Templates sections when none exist in the library

If there are no skills or templates created yet, the searchable multi-select would be empty.

**Fix:** Show inline message: "No skills available. [Create one →]" with link to `/skills/new`. Same for templates.

---

## 4. Missing Error & Edge Case Handling

### 4a. What happens when an agent is deleted that has conversations?

**Fix:** Soft-delete only. Add `deleted_at DATETIME DEFAULT NULL` to the `agents` table. When deleted, set `deleted_at` to current timestamp. Queries for active agents filter `WHERE deleted_at IS NULL`. Past conversations are preserved and viewable but the agent cannot be chatted with (show "This agent has been archived" in the chat view). Optionally add a "Restore" action in settings or admin view.

Actually, for simplicity in v1: show a confirmation dialog that says "This will archive [Agent Name]. Past conversations will be preserved but you won't be able to start new ones. [Archive] [Cancel]". Use the `deleted_at` soft-delete approach.

### 4b. What happens when a skill/template is deleted that is assigned to agents?

The schema has `ON DELETE CASCADE` on `agent_skills` and `agent_templates`. So the join records are automatically removed. But the user should be warned.

**Fix:** Deletion confirmation dialog lists affected agents: "This skill is assigned to: PRD Drafter, Tech Spec Writer. Removing it will unassign it from these agents. [Delete] [Cancel]"

### 4c. What happens during chat if the LLM returns an error mid-stream?

The SSE connection is open and tokens are flowing, then the provider returns an error.

**Fix:** 
- Stop the stream
- Append an error indicator to the partial message: a red-bordered block that says "⚠ Response interrupted: [error message]"
- Re-enable the message input so the user can retry
- Add a "Retry" button on the failed message that resends the last user message

### 4d. What happens if the user sends a message while a response is still streaming?

**Fix:** Prevent it. The message input is disabled (grayed out) while a response is streaming. The send button is replaced with a "Stop" button that cancels the current stream (closes the SSE connection). After stopping, the partial response is kept in the chat and the input re-enables.

### 4e. Token limit / context window exceeded

If the conversation history + system prompt + skills + template exceeds the model's context window.

**Fix:** In the `/api/chat` route, before making the API call, estimate total tokens (rough estimate: 1 token per 4 chars). If it exceeds 80% of the model's context window, truncate older messages from the conversation history (keep the system prompt, skills, template, and the most recent N messages). Show a subtle indicator in the chat: "Earlier messages in this conversation were summarized to fit the context window."

For v1, a simpler approach: just let the API error and handle it with the error handling from 4c. But document this as a known limitation.

### 4f. Concurrent editing of the same agent/skill/template by two users

SQLite handles concurrent reads fine in WAL mode, but concurrent writes could conflict.

**Fix for v1:** Last-write-wins. No locking mechanism needed for 5-10 users. If this becomes a problem, add optimistic locking later (version number on the record, reject if version doesn't match on save).

### 4g. What happens when the user's Google OAuth session expires?

**Fix:** NextAuth.js handles token refresh automatically. If the refresh fails, redirect to `/login` with a flash message: "Your session expired. Please sign in again." Protect all pages except `/login` with an auth middleware check.

---

## 5. Missing Technical Specifications

### 5a. Markdown rendering library not specified

Chat messages need to render Markdown. The PRD doesn't specify which library.

**Fix:** Use `react-markdown` with `remark-gfm` (GitHub Flavored Markdown for tables and strikethrough) and `rehype-highlight` or `rehype-prism` for code syntax highlighting. This is a common, well-maintained stack.

### 5b. Code editor component not specified concretely

PRD says "Monaco or CodeMirror" for the system prompt editor. Pick one.

**Fix:** Use **CodeMirror 6** via `@codemirror/view` and related packages. It's lighter than Monaco (which bundles the entire VS Code editor) and sufficient for editing markdown/text. Use it for: system prompt editor, skill content editor, template content editor, and workspace context editor.

### 5c. How slug generation works

Agents, skills, and templates all have `slug` fields that must be unique. How are they generated?

**Fix:** Auto-generate from the name: lowercase, replace spaces with hyphens, strip non-alphanumeric characters (except hyphens), truncate to 60 characters. If a collision occurs, append `-2`, `-3`, etc. Example: "PRD Drafter" → "prd-drafter". The slug is generated on save, not editable by the user.

### 5d. How conversation "last active" timestamp works for agent cards

Dashboard cards show "Last active: [relative time]" but the query isn't specified.

**Fix:** Query: `SELECT MAX(m.created_at) FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.agent_id = ?`. If no messages exist, show "No conversations yet." Format as relative time: "2h ago", "3d ago", "2w ago", etc. Use a library like `date-fns` (`formatDistanceToNow`).

### 5e. Token estimation for always-on skills

The agent edit form shows "Always-on skills: ~X tokens" but doesn't specify how to estimate.

**Fix:** Simple estimation: `Math.ceil(text.length / 4)`. This is a rough char-to-token approximation that works well enough for English text. Sum the content length of all always-on skills for the agent, divide by 4, round up. Display as "~X tokens" next to the skills section.

### 5f. How the agent suggests a template (SUGGEST_TEMPLATE pattern)

SKILLS_AND_TEMPLATES.md describes the agent outputting `[SUGGEST_TEMPLATE: template-slug]` which the frontend parses. But the agent's system prompt needs to know about available templates to suggest one.

**Fix:** When assembling the system prompt, if the agent has assigned templates AND no template is currently active on the conversation, append this to the system prompt:

```
## Available Templates
You have the following output templates available. If the user's request would benefit from structured output, suggest a template by including exactly this text on its own line: [SUGGEST_TEMPLATE: slug]

Available templates:
- ms1-prd: MS1 Product Requirements Document
- competitive-analysis-matrix: Competitive Analysis Matrix
```

The frontend scans each streamed response chunk for the `[SUGGEST_TEMPLATE: ...]` pattern. When found:
1. Strip it from the displayed message
2. Show a UI prompt: "[Agent Name] suggests using the '[Template Name]' template. [Apply] [Dismiss]"
3. If Apply: set `active_template_id` on the conversation, show the template pill
4. If Dismiss: do nothing, continue conversation

### 5g. What "Test Connection" does on the API Keys page

**Fix:** Makes a minimal API call to each provider:
- Anthropic: `messages.create` with `max_tokens: 1`, a simple "Hi" message
- OpenAI: `chat.completions.create` with `max_tokens: 1`, a simple "Hi" message
- Google: `generateContent` with a simple "Hi" prompt

If successful, show green checkmark + "Connected". If failed, show red X + error message (e.g., "Invalid API key", "Rate limited", "Network error"). The test result is ephemeral (not stored).

### 5h. How the first admin user is determined

The PRD says Danny is the primary admin, but the system uses auto-registration (anyone with the right email domain gets added on first login).

**Fix:** The first user to log in is automatically assigned `role = 'admin'`. All subsequent users get `role = 'member'`. Admins can promote other users to admin via the Team settings page. Implement in the NextAuth.js callback: check if the users table is empty; if so, set role to 'admin'.

---

## 6. Missing Seed Data Details

### 6a. Seed data files referenced but formats not fully specified

The claude.md references `seed-agents.json`, `seed-skills.json`, `seed-templates.json`, and `seed-assignments.json` but only AGENT_DEFINITIONS.md and SKILLS_AND_TEMPLATES.md define the actual content.

**Fix:** The seeding function in `src/lib/db.ts` should:
1. Check if the `agents` table is empty
2. If empty, read seed data files from `context/` directory
3. Insert all seed agents, skills, templates
4. Create join table records for agent-skill and agent-template assignments
5. Create the default workspace context file from `context/workspace.md`
6. All seed records should use `created_by` of the first admin user, or a system user ID

### 6b. Workspace context seeding

The workspace.md seed content exists but there's no spec for how it gets into the database.

**Fix:** On first run (when `context_files` table is empty), create a record:
```sql
INSERT INTO context_files (name, content, scope, agent_id, created_by)
VALUES ('workspace.md', [content from context/workspace.md], 'workspace', NULL, [first_admin_id]);
```

---

## 7. Missing Component Specifications

### 7a. No spec for the Skills Library page layout

SKILLS_AND_TEMPLATES.md has an ASCII wireframe but no full spec like other pages in UI_SPEC.

**Fix:** Skills library page (`/skills`):
- Page title: "Skills Library" in Orbitron
- "+ NEW SKILL" button (primary) top right
- Category filter tabs: All, Research, Writing, Technical, Review (filter by `skills.category`)
- Grid of skill cards (same grid layout as dashboard, 3 columns)
- Each skill card: icon_emoji, name, description (2-line truncated), category badge, "Used by: [agent names]" (from join table), [Edit] and [Duplicate] action buttons
- Clicking the card body navigates to edit page

### 7b. No spec for the Templates Library page layout

**Fix:** Templates library page (`/templates`): Same layout as Skills library. Additional element: format badge showing "MARKDOWN" or "STRUCTURED" on each card. A "Preview" button on each card opens a modal rendering the template markdown.

### 7c. No spec for the Skill/Template create/edit form

**Fix:** Skill create/edit form (`/skills/new` or `/skills/[slug]/edit`):
- Name (text input, required)
- Description (text area, 2 lines)
- Icon Emoji (emoji picker or text input)
- Category (dropdown: Research, Writing, Technical, Review, or custom text input)
- Content (CodeMirror editor, full height, markdown syntax highlighting)
- "Save" (primary) and "Cancel" buttons
- On edit page: "Delete" (destructive) with confirmation showing affected agents

Template create/edit form — same as skill form, plus:
- Format toggle (Markdown / Structured — Structured disabled for v1 with tooltip "Coming soon")
- Preview panel on the right side showing rendered markdown of the template content

### 7d. No confirmation dialog spec

Multiple features reference "confirmation dialog" but it's never specced.

**Fix:** Confirmation dialogs use a centered modal overlay with:
- Glass-morphism background (`--glass-bg` with backdrop-blur)
- Title (Orbitron, e.g., "Delete Agent")
- Body text explaining the action and consequences
- Two buttons: Cancel (secondary/ghost) and Confirm (destructive/primary depending on action)
- Clicking outside the modal or pressing Escape closes it (same as Cancel)
- Focus trap: Tab key cycles through the two buttons while modal is open

### 7e. No toast/notification spec

UI_SPEC mentions "toast notification at top of screen" for network errors but doesn't define it.

**Fix:** Toast notifications appear at the top-right of the viewport:
- Slide in from the right, auto-dismiss after 5 seconds
- Types: success (green accent border), error (magenta accent border), info (cyan accent border)
- Content: icon + text message
- Dismiss button (X) on right side
- Stack vertically if multiple toasts
- Background: `--bg-elevated` with 1px left border in the accent color

---

## 8. Database Indexes

The schema defines tables but no indexes. For even 5-10 users with moderate usage, some queries will be slow without indexes.

**Fix:** Add these indexes to the schema:

```sql
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_context_files_scope ON context_files(scope);
CREATE INDEX idx_context_files_agent_id ON context_files(agent_id);
CREATE INDEX idx_agents_deleted_at ON agents(deleted_at);
CREATE INDEX idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX idx_agent_templates_agent_id ON agent_templates(agent_id);
```

---

## 9. API Route Specifications

The file structure lists API routes but their request/response formats are never defined. Claude Code needs these.

### POST `/api/chat`

**Request body:**
```typescript
{
  conversation_id: string;        // Existing conversation ID
  agent_id: string;               // Agent to chat with
  message: string;                // User's message content
  skill_slugs?: string[];         // On-demand skills to invoke for this message
  template_slug?: string | null;  // Template to activate (null to deactivate)
}
```

**Response:** SSE stream. Each event is a JSON object:
```typescript
// Token event (most common)
{ type: "token", content: "partial text" }

// Done event (sent when stream completes)
{ type: "done", message_id: string, tokens_in: number, tokens_out: number }

// Error event
{ type: "error", message: string }
```

**Logic:**
1. If conversation doesn't exist, create it
2. Save user message to `messages` table
3. If `template_slug` is provided, update `conversations.active_template_id`
4. Assemble system prompt (6-step order)
5. Build message history from `messages` table for this conversation
6. Call LLM provider via abstraction layer
7. Stream response tokens via SSE
8. On completion, save assistant message to `messages` table with token counts

### GET `/api/agents`
Returns all agents where `deleted_at IS NULL`, ordered by most recently active.

### POST `/api/agents`
Creates a new agent. Body: agent fields + skill_ids[] + template_ids[].

### PUT `/api/agents/[id]`
Updates an agent. Body: partial agent fields + skill_ids[] + template_ids[].

### DELETE `/api/agents/[id]`
Soft-deletes (sets `deleted_at`).

### GET `/api/conversations?agent_id=X`
Returns conversations for an agent, ordered by `updated_at` desc.

### GET `/api/conversations/[id]/messages`
Returns all messages for a conversation, ordered by `created_at` asc.

### CRUD routes for `/api/skills`, `/api/templates`, `/api/scratchpad`, `/api/context-files`
Standard REST: GET (list), POST (create), PUT /[id] (update), DELETE /[id] (delete).

### POST `/api/settings/api-keys`
Encrypts and stores API key. Body: `{ provider: string, api_key: string }`.

### POST `/api/settings/api-keys/test`
Tests a provider connection. Body: `{ provider: string }`. Returns `{ success: boolean, error?: string }`.

---

## 10. Keyboard Shortcuts

No keyboard shortcuts are defined. For a power-user internal tool, these matter.

**Fix:** Implement these shortcuts:

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+Enter` | Send message | Chat input focused |
| `Escape` | Close modal/dropdown | Any modal or dropdown open |
| `Cmd+K` | Quick agent search/switch | Global — opens a command palette to quickly jump to any agent's chat |
| `Cmd+N` | New conversation with current agent | Chat view |
| `/skill` | Open skill picker dropdown | Chat input (type as text, triggers dropdown) |

`Cmd+K` command palette: a centered search modal (similar to Raycast/Spotlight) that searches agent names. Select an agent to navigate to its chat. This is the fastest way to switch between agents.

---

## Summary: Corrected Schema

For reference, here is the final corrected `agents` table (with the two removed columns and the added soft-delete):

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
  created_by TEXT NOT NULL REFERENCES users(id),
  is_shared INTEGER DEFAULT 1,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Removed: `context_files TEXT` (use `context_files` table instead), `tools_enabled TEXT` (dead column).
Added: `deleted_at DATETIME DEFAULT NULL` (soft delete).
