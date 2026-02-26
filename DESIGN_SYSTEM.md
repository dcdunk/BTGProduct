# Mission Control — Design System

This document defines the visual design language for Mission Control. The aesthetic is **cyberpunk-inspired**: deep dark environments, electric neon accents, subtle atmospheric textures, and a sense of immersion. Think command center for AI operations, not a SaaS dashboard.

This is an internal tool but it should feel like something the team *wants* to open every morning. The design should make interacting with AI agents feel purposeful and alive.

---

## Design Philosophy

**Cyberpunk, not cosplay.** We're drawing from the visual language of cyberpunk — high contrast, neon on dark, dense information displays, atmospheric depth — but this is still a productivity tool. Readability and usability come first. The aesthetic enhances focus, it doesn't compete with it.

**Key principles:**
1. **Dark-first, light as an option.** Dark mode is the primary experience. Light mode is a functional alternative, not an afterthought.
2. **Neon as signal, not decoration.** Bright accent colors mean something: active states, primary actions, important status. Don't spray neon everywhere.
3. **Depth through layers.** Use subtle gradients, glass-morphism, and shadow to create a sense of spatial depth. Panels float over the background. Elements have dimensionality.
4. **Motion with purpose.** Subtle animations for state changes, streaming indicators, and transitions. Nothing gratuitous. The UI should feel alive but not distracting.
5. **Dense but legible.** Show lots of information (this is a command center) but with clear hierarchy and spacing.

---

## Color System

### Dark Mode (Primary)

Use CSS custom properties throughout. Never hardcode colors.

```css
:root[data-theme="dark"] {
  /* Background layers — darkest to lightest */
  --bg-void: #07080F;           /* Deepest background, app canvas */
  --bg-base: #0C0E1A;           /* Primary surface (sidebar, main area) */
  --bg-elevated: #131627;       /* Cards, panels, modals */
  --bg-hover: #1A1E35;          /* Hover state for interactive elements */
  --bg-active: #222845;         /* Active/selected state */

  /* Neon accents */
  --accent-cyan: #00F0FF;       /* Primary accent — active states, primary buttons, links */
  --accent-cyan-muted: #00F0FF26; /* Cyan at 15% opacity — subtle backgrounds */
  --accent-cyan-glow: 0 0 20px #00F0FF40, 0 0 60px #00F0FF15; /* Glow effect for key elements */

  --accent-magenta: #FF2D78;    /* Secondary accent — alerts, destructive actions, important badges */
  --accent-magenta-muted: #FF2D7826;
  --accent-magenta-glow: 0 0 20px #FF2D7840, 0 0 60px #FF2D7815;

  --accent-green: #00FF88;      /* Success states, online indicators, positive metrics */
  --accent-green-muted: #00FF8826;

  --accent-amber: #FFB800;      /* Warning states, caution indicators */
  --accent-amber-muted: #FFB80026;

  --accent-purple: #A855F7;     /* Tertiary accent — tags, categories, decorative */
  --accent-purple-muted: #A855F726;

  /* Text */
  --text-primary: #E8ECF4;      /* Primary text — high contrast on dark */
  --text-secondary: #8891A5;    /* Secondary text, descriptions, timestamps */
  --text-tertiary: #4A5268;     /* Disabled text, placeholders */
  --text-on-accent: #07080F;    /* Text on neon backgrounds (dark for contrast) */

  /* Borders */
  --border-subtle: #1E2340;     /* Default borders — barely visible */
  --border-default: #2A3055;    /* More prominent borders */
  --border-accent: #00F0FF30;   /* Accent-tinted borders for focus/active states */

  /* Glass / overlay */
  --glass-bg: rgba(12, 14, 26, 0.80);  /* Glassmorphism background */
  --glass-border: rgba(255, 255, 255, 0.06);
  --glass-blur: 16px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --shadow-glow-cyan: 0 0 30px #00F0FF20;
  --shadow-glow-magenta: 0 0 30px #FF2D7820;
}
```

### Light Mode (Alternative)

Light mode should feel like the same design system, not a completely different app. Keep the bold color accents but shift backgrounds to light.

```css
:root[data-theme="light"] {
  /* Background layers */
  --bg-void: #F0F2F8;
  --bg-base: #F7F8FC;
  --bg-elevated: #FFFFFF;
  --bg-hover: #ECEEF5;
  --bg-active: #E0E3F0;

  /* Neon accents — slightly deeper for contrast on light backgrounds */
  --accent-cyan: #0099AA;
  --accent-cyan-muted: #0099AA12;
  --accent-cyan-glow: 0 0 20px #0099AA20;

  --accent-magenta: #D6245E;
  --accent-magenta-muted: #D6245E12;
  --accent-magenta-glow: 0 0 20px #D6245E20;

  --accent-green: #00A858;
  --accent-green-muted: #00A85812;

  --accent-amber: #C48800;
  --accent-amber-muted: #C4880012;

  --accent-purple: #8B3FD4;
  --accent-purple-muted: #8B3FD412;

  /* Text */
  --text-primary: #131627;
  --text-secondary: #5A6178;
  --text-tertiary: #9CA3B8;
  --text-on-accent: #FFFFFF;

  /* Borders */
  --border-subtle: #E5E7EE;
  --border-default: #D0D3DE;
  --border-accent: #0099AA30;

  /* Glass */
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(0, 0, 0, 0.06);
  --glass-blur: 16px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);
  --shadow-glow-cyan: 0 0 30px #0099AA10;
  --shadow-glow-magenta: 0 0 30px #D6245E10;
}
```

### Provider-Specific Colors

Each LLM provider gets a signature color for badges and indicators:

```css
--provider-anthropic: #D4A574;    /* Warm amber/copper for Claude */
--provider-openai: #10A37F;       /* OpenAI's green */
--provider-google: #4285F4;       /* Google blue */
```

---

## Typography

Use two typefaces. Load from Google Fonts.

**Display / Headings:** `"Orbitron", sans-serif`
- Used for: page titles, agent names on dashboard cards, the "Mission Control" wordmark, section headers in settings
- Weight: 500 (medium) for headings, 700 (bold) for the wordmark
- Letter-spacing: +0.05em
- This gives the cyberpunk/tech command center feel

**Body / UI:** `"JetBrains Mono", monospace`
- Used for: all body text, form labels, buttons, navigation, chat messages, code blocks, timestamps
- Weight: 400 (regular) for body, 500 (medium) for emphasis, 700 (bold) for strong
- A monospace font for everything gives the entire app a terminal/hacker feel that reinforces the cyberpunk aesthetic without sacrificing readability
- JetBrains Mono is designed for extended reading unlike most monospace fonts

**Scale:**

```css
--text-xs: 0.75rem;    /* 12px — timestamps, badges */
--text-sm: 0.8125rem;  /* 13px — secondary text, captions */
--text-base: 0.875rem; /* 14px — body text, UI elements */
--text-md: 1rem;       /* 16px — emphasized body, form inputs */
--text-lg: 1.25rem;    /* 20px — section headers */
--text-xl: 1.5rem;     /* 24px — page titles */
--text-2xl: 2rem;      /* 32px — dashboard heading, wordmark */
```

---

## Component Patterns

### Cards (Agent Cards, Skill Cards, Template Cards, Scratchpad Items)

```
┌─────────────────────────────────────┐
│  bg: var(--bg-elevated)             │
│  border: 1px solid var(--border-subtle)
│  border-radius: 12px               │
│  padding: 20px                      │
│  transition: all 0.2s ease          │
│                                     │
│  Hover:                             │
│    border-color: var(--accent-cyan) │
│    box-shadow: var(--shadow-glow-cyan)
│    transform: translateY(-2px)      │
│                                     │
│  Active/Selected:                   │
│    border-color: var(--accent-cyan) │
│    bg: var(--bg-active)             │
└─────────────────────────────────────┘
```

Cards should feel like they "light up" on hover. The glow effect is the key interaction signature.

### Buttons

**Primary (cyan accent):**
```css
.btn-primary {
  background: var(--accent-cyan);
  color: var(--text-on-accent);
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  font-size: var(--text-sm);
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  box-shadow: var(--accent-cyan-glow);
  filter: brightness(1.1);
}
```

**Secondary (outline):**
```css
.btn-secondary {
  background: transparent;
  color: var(--accent-cyan);
  border: 1px solid var(--accent-cyan);
  /* Same padding, font, radius as primary */
}
.btn-secondary:hover {
  background: var(--accent-cyan-muted);
  box-shadow: var(--shadow-glow-cyan);
}
```

**Destructive (magenta):**
```css
.btn-destructive {
  background: var(--accent-magenta);
  color: var(--text-on-accent);
}
.btn-destructive:hover {
  box-shadow: var(--accent-magenta-glow);
}
```

**Ghost (minimal):**
```css
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-ghost:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
```

All buttons use uppercase monospace text. This is a deliberate choice that reinforces the cyberpunk command center feel.

### Sidebar

```css
.sidebar {
  width: 260px;
  background: var(--bg-base);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
}
```

**Nav items:**
- Default: `color: var(--text-secondary)`
- Hover: `color: var(--text-primary); background: var(--bg-hover)`
- Active: `color: var(--accent-cyan); background: var(--accent-cyan-muted); border-left: 2px solid var(--accent-cyan)`

The active indicator is a left-edge cyan bar. Unmistakable.

### Chat Messages

**User message:**
```css
.message-user {
  background: var(--accent-cyan-muted);
  border: 1px solid var(--border-accent);
  border-radius: 12px 12px 2px 12px;
  padding: 12px 16px;
  max-width: 75%;
  align-self: flex-end;
  color: var(--text-primary);
}
```

**Agent message:**
```css
.message-agent {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px 12px 12px 2px;
  padding: 12px 16px;
  max-width: 85%;
  align-self: flex-start;
  color: var(--text-primary);
}
```

**Code blocks inside messages:**
```css
.message-agent pre {
  background: var(--bg-void);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
  font-size: var(--text-sm);
}
```

### Forms / Inputs

```css
input, textarea, select {
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-family: "JetBrains Mono", monospace;
  font-size: var(--text-base);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 3px var(--accent-cyan-muted);
  outline: none;
}
```

### Badges / Pills

Provider badges, status indicators, category tags:

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: "JetBrains Mono", monospace;
}
.badge-cyan { background: var(--accent-cyan-muted); color: var(--accent-cyan); }
.badge-magenta { background: var(--accent-magenta-muted); color: var(--accent-magenta); }
.badge-green { background: var(--accent-green-muted); color: var(--accent-green); }
.badge-purple { background: var(--accent-purple-muted); color: var(--accent-purple); }
```

### Skill Mode Toggle

The always-on / on-demand toggle for skills:

```css
.skill-mode-toggle {
  /* Segmented control style */
  display: inline-flex;
  background: var(--bg-base);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  overflow: hidden;
}
.skill-mode-toggle button {
  padding: 4px 12px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  border: none;
  background: transparent;
  color: var(--text-secondary);
}
.skill-mode-toggle button.active {
  background: var(--accent-cyan-muted);
  color: var(--accent-cyan);
}
```

### Template Active Pill (in chat)

```css
.template-active-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--accent-purple-muted);
  border: 1px solid var(--accent-purple);
  border-radius: 999px;
  font-size: var(--text-xs);
  color: var(--accent-purple);
  text-transform: uppercase;
}
.template-active-pill .close {
  cursor: pointer;
  opacity: 0.6;
}
.template-active-pill .close:hover {
  opacity: 1;
}
```

---

## Atmospheric Details

These are the details that make the cyberpunk aesthetic feel immersive rather than superficial.

### Background Texture

Apply a subtle noise/grain texture to `--bg-void` to prevent flat-feeling backgrounds:

```css
body {
  background-color: var(--bg-void);
  background-image: url("data:image/svg+xml,..."); /* inline subtle noise SVG */
  /* Or use CSS: */
  background-image: 
    radial-gradient(ellipse at 20% 50%, #00F0FF06 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, #FF2D7806 0%, transparent 50%);
}
```

The two subtle radial gradients (cyan and magenta) cast very faint ambient "light sources" across the background. This creates atmosphere without competing with content.

### Grid Lines (Optional, Dashboard Only)

A very faint grid pattern on the dashboard background evokes the cyberpunk "digital grid" aesthetic:

```css
.dashboard-bg {
  background-image: 
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 60px 60px;
  background-position: center center;
  opacity: 0.3;
}
```

Use sparingly — only on the dashboard, not on every page.

### Streaming Animation

When an agent is generating a response, show a pulsing cyan cursor:

```css
@keyframes pulse-glow {
  0%, 100% { opacity: 0.4; box-shadow: 0 0 8px var(--accent-cyan); }
  50% { opacity: 1; box-shadow: 0 0 20px var(--accent-cyan); }
}
.streaming-indicator {
  display: inline-block;
  width: 8px;
  height: 18px;
  background: var(--accent-cyan);
  border-radius: 2px;
  animation: pulse-glow 1.2s ease-in-out infinite;
}
```

### Status Indicators

Online/active indicators use the green accent with a subtle pulse:

```css
@keyframes status-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-green); }
  50% { box-shadow: 0 0 0 4px var(--accent-green-muted); }
}
.status-online {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
  animation: status-pulse 2s ease-in-out infinite;
}
```

### Page Transitions

Use subtle fade-in for page navigation:

```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-content {
  animation: page-enter 0.3s ease-out;
}
```

### Scrollbar Styling (Dark Mode)

```css
[data-theme="dark"] ::-webkit-scrollbar {
  width: 8px;
}
[data-theme="dark"] ::-webkit-scrollbar-track {
  background: var(--bg-base);
}
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 4px;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
```

---

## Wordmark / Logo

"MISSION CONTROL" in Orbitron, weight 700, tracked wide.

```css
.wordmark {
  font-family: "Orbitron", sans-serif;
  font-weight: 700;
  font-size: var(--text-lg);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-primary);
}
.wordmark .accent {
  color: var(--accent-cyan);
}
```

Display as: `MISSION` in primary text color, `CONTROL` in cyan. Or the full text with a subtle cyan underline/glow.

In the sidebar, the wordmark sits at the top with generous padding below. It's the first thing you see and it sets the tone.

---

## Iconography

Use **Lucide React** icons throughout. They're clean, consistent, and available in the React ecosystem.

Icon sizing:
- Navigation: 18px
- Card actions: 16px
- Inline with text: 14px
- Dashboard/feature icons: 24px

Icon color: inherit from parent text color by default. Accent colors for interactive/status icons.

---

## Spacing Scale

Use a consistent 4px base grid:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

---

## Tailwind Configuration

Since the project uses Tailwind, extend the default config with the design system tokens:

```javascript
// tailwind.config.ts
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        void: 'var(--bg-void)',
        base: 'var(--bg-base)',
        elevated: 'var(--bg-elevated)',
        'surface-hover': 'var(--bg-hover)',
        'surface-active': 'var(--bg-active)',
        cyan: {
          DEFAULT: 'var(--accent-cyan)',
          muted: 'var(--accent-cyan-muted)',
        },
        magenta: {
          DEFAULT: 'var(--accent-magenta)',
          muted: 'var(--accent-magenta-muted)',
        },
        neon: {
          green: 'var(--accent-green)',
          amber: 'var(--accent-amber)',
          purple: 'var(--accent-purple)',
        },
      },
      fontFamily: {
        display: ['"Orbitron"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderColor: {
        subtle: 'var(--border-subtle)',
        default: 'var(--border-default)',
        accent: 'var(--border-accent)',
      },
      boxShadow: {
        'glow-cyan': 'var(--accent-cyan-glow)',
        'glow-magenta': 'var(--accent-magenta-glow)',
      },
    },
  },
};
```

This lets developers use classes like `bg-void`, `text-cyan`, `border-subtle`, `font-display`, `shadow-glow-cyan` throughout the app while keeping the design system centralized.

---

## Theme Switching

Store theme preference in localStorage and as a `data-theme` attribute on `<html>`.

```typescript
// src/lib/theme.ts
export function getTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('mc-theme') as 'dark' | 'light') || 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  localStorage.setItem('mc-theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}
```

Toggle component: a simple icon button in the header. Moon icon for dark, sun for light. Transition smoothly (0.3s on background-color and color for all elements).

Default: **dark mode**. Always.

---

## Implementation Notes for Claude Code

1. **Define all CSS custom properties in `src/app/globals.css`** inside `:root[data-theme="dark"]` and `:root[data-theme="light"]` blocks. Reference them via Tailwind extended theme.

2. **Google Fonts**: Import Orbitron (weights 500, 700) and JetBrains Mono (weights 400, 500, 700) in the Next.js layout. Use `next/font/google` for optimized loading.

3. **Don't use Tailwind's built-in dark: prefix.** Use the `data-theme` attribute approach instead, since our dark mode is the primary mode and light mode is the exception.

4. **The glow effects (box-shadow with neon colors) are the signature interaction.** Apply them on hover for cards, focused inputs, and primary buttons. Don't overuse — if everything glows, nothing stands out.

5. **Background atmosphere (faint radial gradients) goes on the root layout only.** Individual pages shouldn't add their own background effects.

6. **Code blocks in chat messages use `--bg-void`** (darkest color) to create maximum contrast and a "terminal within a terminal" feel.

7. **All text that functions as a label, button, badge, or navigation item should be uppercase monospace.** This is the most distinctive aspect of the visual language. Body text in messages and long-form content stays normal case.
