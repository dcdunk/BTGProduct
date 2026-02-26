# Mission Control — UI/UX Specification

This document describes the interface screens, layout patterns, and interaction behaviors. It's written for an AI developer to implement, not for a designer to review. Be literal with this spec.

---

## Global Layout

The app uses a persistent sidebar + main content area layout.

```
┌──────────────────────────────────────────────────┐
│  Header: "Mission Control" logo/text + user menu │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  Sidebar   │         Main Content Area           │
│  (240px)   │         (fluid width)               │
│            │                                     │
│            │                                     │
│            │                                     │
│            │                                     │
└────────────┴─────────────────────────────────────┘
```

### Sidebar Navigation

- **Dashboard** (home icon) — agent grid overview
- **Agents** (users icon) — agent list/management
- **Skills** (lightning icon) — skills library
- **Templates** (document icon) — templates library
- **Scratchpad** (clipboard icon) — shared scratchpad items
- **Settings** (gear icon) — workspace settings, API keys, context files
- Divider
- **Recent Conversations** — list of last 5-10 conversations with agent emoji + title, clickable to resume

### Header

- Left: "Mission Control" text or small logo
- Right: User avatar (Google profile picture) + dropdown with "Settings" and "Sign Out"

### Color Palette, Typography, and Visual Style

**All visual design decisions are defined in `DESIGN_SYSTEM.md`.** That document is the single source of truth for colors, fonts, component styling, animations, and atmospheric effects.

Summary: The app uses a cyberpunk-inspired aesthetic with dark-first design. Neon cyan (#00F0FF) and magenta (#FF2D78) accents on deep dark backgrounds. Orbitron for display headings, JetBrains Mono for all body/UI text. Light mode is a functional alternative with deeper accent tones. Glow effects on hover are the signature interaction pattern.

Refer to `DESIGN_SYSTEM.md` for the complete CSS custom property definitions, Tailwind config, and component-level styling specs.

---

## Screen: Dashboard (`/`)

The landing page after login. Shows all agents as a grid of cards.

### Layout

```
┌──────────────────────────────────────────┐
│  Welcome, [First Name]       [+ New Agent] │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Agent   │ │  Agent   │ │  Agent   │   │
│  │  Card 1  │ │  Card 2  │ │  Card 3  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                          │
│  ┌─────────┐ ┌─────────┐               │
│  │  Agent   │ │  Agent   │               │
│  │  Card 4  │ │  Card 5  │               │
│  └─────────┘ └─────────┘               │
│                                          │
└──────────────────────────────────────────┘
```

### Agent Card

Each card contains:
- Large emoji avatar (32px+)
- Agent name (bold)
- Agent description (2 lines max, truncated with ellipsis)
- Provider badge: small colored pill showing "Claude" / "GPT" / "Gemini"
- Footer: "Last active: [relative time]" or "No conversations yet"
- Entire card is clickable → navigates to `/agents/[slug]` (chat view)
- Hover state: subtle shadow elevation

### Interactions
- Click card → open chat with that agent
- "+" button → navigate to `/agents/new`
- Cards are ordered by last active (most recent first), with never-used agents at the end

---

## Screen: Agent Chat (`/agents/[slug]`)

The primary interaction screen. Full chat interface with conversation management.

### Layout

```
┌────────────────┬──────────────────────────────┐
│ Conversations  │  Agent Header                │
│ Sidebar        │  ┌────────────────────────┐  │
│                │  │                        │  │
│ [+ New Chat]   │  │    Message History      │  │
│                │  │    (scrollable)         │  │
│ Conv 1 ●       │  │                        │  │
│ Conv 2         │  │                        │  │
│ Conv 3         │  │                        │  │
│                │  └────────────────────────┘  │
│                │  ┌────────────────────────┐  │
│                │  │  Message Input          │  │
│                │  └────────────────────────┘  │
└────────────────┴──────────────────────────────┘
```

### Agent Header
- Agent emoji + name
- Agent description (smaller text)
- Provider/model badge
- "Edit Agent" button (icon, top right)
- "Save to Scratchpad" button (icon, appears on hover over messages)

### Conversation Sidebar (left, within chat view)
- Width: 260px
- "New Conversation" button at top
- List of past conversations with this agent
- Each item: auto-generated title (from first user message), timestamp
- Active conversation highlighted
- Click to switch conversations

### Message History
- User messages: right-aligned, blue background, white text
- Agent messages: left-aligned, white background, dark text
- Agent messages render Markdown: headings, code blocks (with syntax highlighting), bold, italic, links, lists, tables
- Streaming indicator: pulsing cursor or "..." animation while response is streaming
- Each message has a subtle timestamp on hover
- Agent messages have a "Copy" button on hover
- Agent messages have a "Save to Scratchpad" button on hover

### Message Input
- Full-width text area at bottom of chat
- Auto-expanding height (1 line default, grows up to 6 lines, then scrolls internally)
- Send button on right side (or Cmd+Enter to send)
- Placeholder text: "Message [Agent Name]..."
- Disabled (grayed out) while agent is responding
- Left of send button: Skills button (⚡ icon) — opens dropdown of on-demand skills assigned to this agent. Selecting inserts a skill chip/pill into the input.
- Left of skills button: Template button (📄 icon) — opens dropdown of templates assigned to this agent. Selecting activates the template for the conversation.
- When a template is active: show a pill/badge above the input area: "[Template Name] ✕" — click ✕ to deactivate

---

## Screen: Create/Edit Agent (`/agents/new` or `/agents/[slug]/edit`)

### Layout

A form page with sections. Vertically scrollable.

### Form Fields

**Identity Section**
- Name (text input, required)
- Description (text area, 2-3 lines, required)
- Avatar Emoji (emoji picker or text input)

**LLM Configuration Section**
- Provider (dropdown: Anthropic, OpenAI, Google — only show providers that have API keys configured)
- Model (dropdown: populated based on selected provider)
  - Anthropic: claude-sonnet-4-20250514, claude-haiku-4-5-20251001
  - OpenAI: gpt-4o, gpt-4o-mini
  - Google: gemini-2.0-flash, gemini-2.0-pro
- Temperature (slider: 0.0 to 1.0, default 0.7, with labels "Precise" at 0 and "Creative" at 1)

**System Prompt Section**
- Large code editor (Monaco or CodeMirror) for the system prompt
- Syntax highlighting for Markdown
- Minimum height: 300px
- Helper text: "This is the core instruction set for the agent. Workspace context is automatically prepended."

**Context Files Section**
- List of attached context files (name + preview of first 2 lines)
- "Add Context File" button → opens modal with name input + content editor
- Each file has Edit and Remove buttons
- Helper text: "These files are included in the agent's context after workspace files and before the system prompt."

**Skills Section**
- Searchable multi-select of all skills in the global library
- Each assigned skill shows: emoji + name + mode toggle (Always On / On Demand)
- Default mode: On Demand
- Drag handles for reordering always-on skills (controls system prompt order)
- Token estimate displayed: "Always-on skills: ~X tokens"
- "Manage Skills" link → navigates to `/skills` to create/edit skills
- Helper text: "Always-on skills are included in every conversation. On-demand skills are available when you or the agent invokes them."

**Templates Section**
- Searchable multi-select of all templates in the global library
- Each assigned template shows: emoji + name + format badge
- Drag handles for reordering (controls order in chat template picker)
- "Manage Templates" link → navigates to `/templates`
- Helper text: "Templates structure the agent's output. Users can select a template during chat, or the agent can suggest one."

**Visibility Section**
- Toggle: "Shared with workspace" (default on) / "Private"

### Actions
- "Save Agent" button (primary, blue)
- "Delete Agent" button (destructive, red, with confirmation dialog — edit page only)
- "Duplicate Agent" button (secondary — edit page only)
- "Cancel" link (returns to previous page)

---

## Screen: Settings (`/settings`)

### Sub-navigation (tabs or secondary sidebar)

1. **API Keys** (`/settings/api-keys`)
2. **Workspace Context** (`/settings/context`)
3. **Team** (`/settings/team`)

### API Keys Page

For each provider (Anthropic, OpenAI, Google):
- Provider name + logo/icon
- Status indicator: green dot = configured, gray dot = not configured
- API key input (masked, shows last 4 characters if set)
- "Update" / "Remove" buttons
- "Test Connection" button that makes a minimal API call to verify the key works

### Workspace Context Page

- Large editor for the primary `workspace.md` file
- This is the content that gets prepended to every agent's system prompt
- "Save" button
- "Reset to Default" button (restores seed content)
- Preview panel showing how many tokens the workspace context consumes (helpful for managing context window)

### Team Page

- List of users who have logged in
- Columns: Name, Email, Role (Admin/Member), Last Active
- Admin can toggle roles
- No invite system — anyone with an allowed email domain who visits the app and authenticates is added automatically

---

## Screen: Scratchpad (`/scratchpad`)

### Layout

```
┌──────────────────────────────────────────┐
│  Scratchpad                  [+ New Item] │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Title: PRD Draft - Launch Mon v3  │   │
│  │ Source: PRD Drafter · 2h ago      │   │
│  │ Preview: "## Executive Summary..."│   │
│  │ [Open] [Send to Agent] [Delete]   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │ Title: Competitor Matrix          │   │
│  │ Source: Competitive Intel · 1d ago│   │
│  │ Preview: "| Feature | BTG |..."   │   │
│  │ [Open] [Send to Agent] [Delete]   │   │
│  └──────────────────────────────────┘   │
│                                          │
└──────────────────────────────────────────┘
```

### Scratchpad Item Card
- Title (editable)
- Source: which agent and conversation it came from (auto-populated)
- Created by: user who saved it
- Timestamp
- Content preview (first 3 lines)
- Actions: Open (full view in modal), Send to Agent (dropdown to pick target agent, opens new conversation with this content prepended), Delete

### "Send to Agent" Flow
1. User clicks "Send to Agent" on a scratchpad item
2. Dropdown shows all agents
3. Selecting an agent opens a new conversation with that agent
4. The scratchpad content is included as the first message (prefixed with "Context from scratchpad:\n\n")
5. User can then type their follow-up instruction

---

## Screen: Login (`/login`)

Simple, centered login page.

```
┌──────────────────────────────┐
│                              │
│      🎯 Mission Control      │
│                              │
│  Internal AI Agent Dashboard │
│                              │
│  ┌────────────────────────┐  │
│  │  Sign in with Google   │  │
│  └────────────────────────┘  │
│                              │
│  Blue Tees Golf · Internal   │
│                              │
└──────────────────────────────┘
```

- Single button: "Sign in with Google" (Google OAuth)
- If user's email domain doesn't match `ALLOWED_EMAIL_DOMAIN`, show error: "Access restricted to [domain] accounts."

---

## Responsive Behavior

This is a desktop-only internal tool. Design for 1280px+ viewport width. If viewport is below 1024px, show a message: "Mission Control is designed for desktop use. Please use a wider screen."

No need for mobile layouts, hamburger menus, or responsive breakpoints.

---

## Loading States

- **Page navigation**: Minimal — use Next.js loading.tsx with a simple spinner or skeleton
- **Chat streaming**: Show agent avatar with a pulsing dot animation while waiting for first token. Then render tokens as they arrive.
- **Form submission**: Button shows spinner and disables during save
- **Initial load**: Skeleton cards on dashboard while agents are fetched

## Error States

- **API key not configured**: When user tries to chat with an agent whose provider has no API key, show inline error: "No API key configured for [Provider]. Add one in Settings > API Keys."
- **LLM error**: Display error message inline in chat: "Error: [message]. Try again or switch to a different model."
- **Auth error**: Redirect to login with flash message
- **Network error**: Toast notification at top of screen
