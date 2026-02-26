# Mission Control — Skills & Templates Addendum

This document extends the PRD with two new features: **Skills** (reusable capability modules) and **Templates** (structured output formats). Both are global libraries that get assigned to agents.

---

## Concepts

### Skills

A skill is a focused, reusable instruction set that gives an agent a specific capability. Skills are more granular than an agent's system prompt — they represent discrete things an agent knows how to do.

**Examples:**
- "Market Sizing" — knows how to estimate TAM/SAM/SOM with structured methodology
- "BOM Estimation" — can break down component costs for hardware products
- "Risk Assessment" — produces risk matrices with likelihood/impact/mitigation
- "User Story Writing" — generates user stories in proper format from feature descriptions
- "Competitive Pricing Analysis" — structures pricing comparisons across competitors
- "BLE Protocol Design" — specifies Bluetooth GATT services, characteristics, and data formats

**How skills work:**
1. Skills live in a global library. Any team member can create or edit skills.
2. Skills are assigned to agents. An agent can have 0 or many skills.
3. When assigned to an agent, the skill's instruction content is appended to the agent's system prompt (after workspace context, agent context files, and agent system prompt).
4. Skills can optionally be "invocable" — the user can explicitly activate a skill during a conversation by typing `/skill [skill-name]` or selecting it from a dropdown. When invoked this way, the skill instructions are injected into that specific message turn rather than being present in every turn.

**Two modes of skill inclusion:**
- **Always-on**: Skill instructions are included in every conversation with the agent. Good for foundational capabilities the agent should always have.
- **On-demand**: Skill instructions are only included when explicitly invoked. Good for specialized capabilities that would bloat the system prompt if always present. This is the default.

This distinction matters for context window management. An agent with 10 always-on skills would consume significant tokens before the user says anything.

### Templates

A template is a structured output format that an agent fills in when producing a deliverable. Templates define the shape and sections of the output — the agent supplies the content.

**Examples:**
- "MS1 Product Requirements Document" — sections for executive summary, problem statement, features, specs, timeline, BOM, risks
- "Competitive Analysis Matrix" — table structure with rows per competitor and columns per evaluation dimension
- "Gate Review Checklist" — list of criteria that must be addressed for a development gate
- "Product Brief" — one-pager format for communicating product concepts to leadership

**How templates work:**
1. Templates live in a global library. Any team member can create or edit templates.
2. Templates are assigned to agents. An agent can have 0 or many templates.
3. Templates can be invoked in two ways:
   - **User-selected**: User picks a template from a dropdown before or during a conversation. The template structure is injected into the next message as context.
   - **Agent-suggested**: The agent, based on conversation context, recognizes that a template would be appropriate and suggests it. The user confirms, and the template is injected.
4. When a template is active in a conversation, the agent structures its output to fill the template's sections.

**Template format (v1 — Markdown):**
Templates are authored as Markdown documents with section headers, placeholder descriptions, and optional example content. This is the simplest format to create and iterate on.

```markdown
# [Document Title]

## Executive Summary
<!-- 1-2 paragraphs. Problem, solution, target user, expected outcome. -->

## Problem Statement
<!-- What pain point exists. Who feels it. Evidence this is real. Why now. -->

## Target User
<!-- Demographics, psychographics, use case. Be specific enough to make design decisions. -->

...
```

The `<!-- comment -->` blocks are instructions to the agent about what goes in each section. They're stripped from the final output.

**Template format (future — Structured Schema):**
A JSON schema that defines fields, types, validation rules, and relationships. This enables form-based output and programmatic validation. Not implemented in v1 but the data model accommodates it.

```json
{
  "type": "structured",
  "sections": [
    {
      "key": "executive_summary",
      "label": "Executive Summary",
      "type": "text",
      "instructions": "1-2 paragraphs covering problem, solution, user, outcome",
      "required": true,
      "max_length": 500
    }
  ]
}
```

---

## Data Model Additions

### `skills` table

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '🔧',
  content TEXT NOT NULL,            -- The skill instruction text (markdown)
  category TEXT,                     -- Optional grouping: "research", "writing", "technical", "review"
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `agent_skills` join table

```sql
CREATE TABLE agent_skills (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'on_demand' CHECK (mode IN ('always_on', 'on_demand')),
  sort_order INTEGER DEFAULT 0,      -- Controls order in system prompt for always-on skills
  PRIMARY KEY (agent_id, skill_id)
);
```

### `templates` table

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '📄',
  format TEXT NOT NULL DEFAULT 'markdown' CHECK (format IN ('markdown', 'structured')),
  content TEXT NOT NULL,             -- Markdown template or JSON schema (based on format)
  category TEXT,                     -- Optional grouping: "prd", "analysis", "review", "brief"
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `agent_templates` join table

```sql
CREATE TABLE agent_templates (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (agent_id, template_id)
);
```

### `conversation_state` addition

Add a column to the `conversations` table to track the active template:

```sql
ALTER TABLE conversations ADD COLUMN active_template_id TEXT REFERENCES templates(id);
```

When a template is selected for a conversation (by user or agent suggestion), this field is set. The chat API route checks this field and includes the template content in the system prompt for subsequent messages in that conversation.

---

## Updated System Prompt Assembly

The system prompt assembly order (from PRD Section: Architecture) is updated to include skills and the active template:

```
1. [Workspace context files — scope='workspace']
---
2. [Agent-specific context files — agent_id matches]
---
3. [Agent system prompt]
---
4. [Always-on skill instructions — from agent_skills where mode='always_on', ordered by sort_order]
---
5. [Active template — if conversation has active_template_id set]
   Injected as: "## Active Template\nStructure your response according to this template:\n\n{template_content}"
---
6. [On-demand skill — if user invoked /skill in the current message]
   Injected as: "## Activated Skill: {skill_name}\nApply the following instructions for this response:\n\n{skill_content}"
```

Steps 5 and 6 are conditional — only included when relevant. Steps 1-4 are always present.

---

## Updated Feature List

### P0 Additions

**F14: Skills Library**
- Global list view of all skills at `/skills`
- Each skill card shows: emoji icon, name, description, category tag, number of agents using it
- Create/edit skill form with: name, description, icon emoji, category, content (markdown editor)
- Skill content editor should be full-height (similar to agent system prompt editor)
- Delete skill (with confirmation, warns if assigned to agents)

**F15: Template Library**
- Global list view of all templates at `/templates`
- Each template card shows: emoji icon, name, description, category tag, format badge (markdown/structured), number of agents using it
- Create/edit template form with: name, description, icon emoji, category, content (markdown editor with preview panel)
- Template preview: render the markdown template in a side panel so authors can see what the structure looks like
- Delete template (with confirmation, warns if assigned to agents)

**F16: Assign Skills to Agents**
- On the agent create/edit form, add a "Skills" section below Context Files
- Multi-select dropdown or searchable checklist of all available skills
- For each assigned skill, show a toggle: "Always On" vs "On Demand" (default: On Demand)
- Drag-to-reorder for always-on skills (controls sort_order, which determines system prompt order)
- Show estimated token count for all always-on skills combined (helps manage context window)

**F17: Assign Templates to Agents**
- On the agent create/edit form, add a "Templates" section below Skills
- Multi-select dropdown or searchable checklist of all available templates
- Drag-to-reorder (controls sort_order, which determines the order in the template picker during chat)

**F18: Template Selection in Chat**
- In the chat interface, add a template picker above or beside the message input
- Small button or dropdown: "Use Template" → shows list of templates assigned to this agent
- Selecting a template sets `active_template_id` on the conversation
- Active template shown as a small pill/badge above the message input: "[Template Name] ✕" (click X to deactivate)
- When active, the agent structures its next response according to the template
- Agent can also suggest a template mid-conversation. Implementation: include the list of available template names in the system prompt. Agent outputs a suggestion like: `[SUGGEST_TEMPLATE: template-slug]`. The frontend parses this and shows a confirmation: "PRD Drafter suggests using the 'MS1 PRD' template. [Apply] [Dismiss]"

**F19: Skill Invocation in Chat**
- In the chat interface, user can type `/skill` to see a dropdown of on-demand skills assigned to the current agent
- Selecting a skill inserts it as a tag in the message input: `/skill [skill-name]`
- The chat API route detects this tag, resolves the skill, strips the tag from the user's message, and injects the skill instructions for that turn only
- Alternatively: a small "Skills" button next to the message input that opens the same dropdown

---

## UI Additions

### Skills Library Page (`/skills`)

```
┌──────────────────────────────────────────────┐
│  Skills Library                  [+ New Skill] │
├──────────────────────────────────────────────┤
│  [All] [Research] [Writing] [Technical] [Review] │  ← Category filter tabs
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🔧 Market Sizing           Research  │   │
│  │ Estimates TAM/SAM/SOM with...        │   │
│  │ Used by: PRD Drafter, Competitive... │   │
│  │ [Edit] [Duplicate]                   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 🔧 BOM Estimation          Technical │   │
│  │ Breaks down component costs for...   │   │
│  │ Used by: PRD Drafter, Tech Spec...   │   │
│  │ [Edit] [Duplicate]                   │   │
│  └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

### Template Library Page (`/templates`)

Same layout pattern as Skills but with format badge (Markdown / Structured) and a "Preview" button that opens a modal rendering the template.

### Agent Edit Form — Skills Section

```
┌──────────────────────────────────────────────┐
│  Skills                                      │
│  ┌──────────────────────────────────────┐   │
│  │ 🔍 Search skills...                  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Assigned Skills:                            │
│  ┌──────────────────────────────────────┐   │
│  │ ≡ Market Sizing      [Always On ▾] ✕ │   │
│  │ ≡ BOM Estimation     [On Demand ▾] ✕ │   │
│  │ ≡ Risk Assessment    [On Demand ▾] ✕ │   │
│  └──────────────────────────────────────┘   │
│  ≡ = drag handle for reordering              │
│                                              │
│  ⚠️ Always-on skills: ~1,200 tokens          │
└──────────────────────────────────────────────┘
```

### Chat Interface — Template & Skill Controls

```
┌──────────────────────────────────────────────┐
│                                              │
│           Message History                    │
│                                              │
├──────────────────────────────────────────────┤
│  📄 MS1 PRD Template ✕          ← Active template pill (click ✕ to remove)
│  ┌──────────────────────────────────────┐   │
│  │  Message input...          [⚡] [📄] [➤]│   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ⚡ = Skills dropdown    📄 = Template picker │
│  ➤ = Send button                             │
└──────────────────────────────────────────────┘
```

When user clicks ⚡ (Skills button):
- Dropdown lists on-demand skills assigned to this agent
- Selecting one inserts `/skill [name]` tag into the message input as a styled chip/pill (not raw text)
- Multiple skills can be invoked in one message

When user clicks 📄 (Template button):
- Dropdown lists templates assigned to this agent
- Selecting one activates it for the conversation
- Shows preview of template structure on hover

---

## Updated Sidebar Navigation

Add two new items to the global sidebar:

```
- Dashboard
- Agents
- Skills        ← NEW
- Templates     ← NEW
- Scratchpad
- Settings
```

---

## Seed Skills

Include these starter skills in `context/seed-skills.json`:

### Market Sizing
```json
{
  "name": "Market Sizing",
  "slug": "market-sizing",
  "icon_emoji": "📊",
  "category": "research",
  "content": "## Market Sizing Skill\n\nWhen asked to size a market, follow this methodology:\n\n### 1. Define the Market\n- What product category? What geography? What time frame?\n- Clarify if estimating TAM (Total Addressable Market), SAM (Serviceable Addressable Market), or SOM (Serviceable Obtainable Market)\n\n### 2. Top-Down Estimate\n- Start with the broadest relevant market size (cite source)\n- Apply successive filters to narrow: geography, segment, price point, adoption rate\n- Show your math at each step\n\n### 3. Bottom-Up Estimate\n- Identify the number of potential customers in the target segment\n- Multiply by expected purchase frequency and price point\n- Account for competitive dynamics and market share assumptions\n\n### 4. Triangulate\n- Compare top-down and bottom-up estimates\n- Explain any significant discrepancy\n- Provide a range (conservative / base / optimistic) with stated assumptions\n\n### 5. Output Format\n- TAM: $X (how calculated)\n- SAM: $X (filters applied)\n- SOM: $X (realistic capture rate with reasoning)\n- Growth rate: X% CAGR with source\n- Key assumptions listed explicitly"
}
```

### BOM Estimation
```json
{
  "name": "BOM Estimation",
  "slug": "bom-estimation",
  "icon_emoji": "🧮",
  "category": "technical",
  "content": "## BOM Estimation Skill\n\nWhen asked to estimate a Bill of Materials, follow this structure:\n\n### 1. Component Breakdown\nList every physical component in the product. For each:\n- Component name and function\n- Specification (key parameters)\n- Estimated unit cost at target volume (state the volume assumption)\n- Lead time (weeks)\n- Single source or multi-source availability\n- Supplier(s) if known\n\n### 2. Standard Component Categories for Golf Tech\n- Radar/sensor module: $8-25 depending on chipset\n- BLE module (e.g., Nordic nRF52/nRF53 series): $2-5\n- MCU/SoC: $3-12 depending on processing needs\n- Display (if applicable): OLED $3-8, LCD $1-3\n- Battery (Li-ion/LiPo): $2-6 based on capacity\n- PCB + assembly: $3-8 depending on layer count and component density\n- Enclosure (injection molded): $1-4 per unit (amortized tooling separate)\n- Connectors, buttons, misc hardware: $1-3\n- Packaging: $1-3\n\n### 3. Cost Roll-Up Table\n| Component | Spec | Unit Cost | Lead Time | Source Risk |\n|-----------|------|-----------|-----------|-------------|\n| ... | ... | $X.XX | X weeks | Low/Med/High |\n| **Total BOM** | | **$X.XX** | | |\n\n### 4. Non-BOM Costs (flag separately)\n- NRE (non-recurring engineering): firmware development, mechanical design, PCB layout\n- Tooling: injection mold tooling ($15K-50K per mold)\n- Certification: FCC ($10-20K), CE ($5-15K), IC ($5-10K)\n- Assembly/test fixtures: $5-15K\n\n### 5. Assumptions & Risks\n- State volume assumption (costs vary significantly: 1K vs 10K vs 100K units)\n- Flag components with volatile pricing or supply constraints\n- Note any components approaching EOL (end of life)"
}
```

### User Story Writing
```json
{
  "name": "User Story Writing",
  "slug": "user-story-writing",
  "icon_emoji": "👤",
  "category": "writing",
  "content": "## User Story Writing Skill\n\nWhen asked to write user stories, follow this approach:\n\n### Format\nAs a [specific user type], I want to [concrete action] so that [measurable outcome].\n\n### Acceptance Criteria\nEvery user story must include acceptance criteria written as:\n- Given [context], when [action], then [expected result]\n- Minimum 2 acceptance criteria per story, covering the happy path and at least one edge case\n\n### Prioritization\nTag each story with priority:\n- P0: Must have for launch. Product is broken without it.\n- P1: Should have for launch. Product is significantly weaker without it.\n- P2: Nice to have. Can ship without it and add later.\n\n### Story Quality Checklist\n- Is the user type specific enough? (Not just 'user' — who exactly?)\n- Is the action concrete and testable?\n- Is the outcome a real benefit, not a restatement of the action?\n- Are acceptance criteria verifiable by QA?\n- Is the story small enough to build in one sprint? If not, break it down.\n\n### For Hardware-Software Products\n- Distinguish between hardware stories (physical interaction), firmware stories (device behavior), and app stories (software experience)\n- Flag stories that span hardware and software — these are integration points and carry higher risk\n- Include stories for: setup/pairing, normal use, error recovery, firmware update, battery/charging"
}
```

### Risk Assessment
```json
{
  "name": "Risk Assessment",
  "slug": "risk-assessment",
  "icon_emoji": "⚠️",
  "category": "review",
  "content": "## Risk Assessment Skill\n\nWhen asked to assess risks, produce a structured risk matrix:\n\n### Risk Categories\nAlways consider these categories:\n1. **Technical** — Can we build it? Unproven technology, integration complexity, performance uncertainty\n2. **Supply Chain** — Can we source it? Component availability, single-source dependencies, lead times\n3. **Regulatory** — Can we sell it? FCC/CE/IC certification, compliance changes, safety standards\n4. **Schedule** — Can we ship on time? Dependencies, parallel workstreams, resource constraints\n5. **Market** — Will anyone buy it? Competitive response, pricing pressure, demand assumptions\n6. **Quality** — Will it work reliably? Durability, environmental tolerance, software stability\n\n### Risk Matrix Format\n| # | Risk | Category | Likelihood (1-5) | Impact (1-5) | Score | Mitigation | Owner |\n|---|------|----------|-------------------|--------------|-------|------------|-------|\n\nScore = Likelihood × Impact. Sort by score descending.\n\n### Likelihood Scale\n1 = Rare (< 10%), 2 = Unlikely (10-25%), 3 = Possible (25-50%), 4 = Likely (50-75%), 5 = Almost Certain (> 75%)\n\n### Impact Scale\n1 = Negligible (minor inconvenience), 2 = Minor (workaround exists), 3 = Moderate (delays or cost increase), 4 = Major (significant scope/timeline change), 5 = Critical (project viability threatened)\n\n### Response Strategies\nFor each high-score risk (≥ 12), specify one of:\n- **Mitigate**: Actions to reduce likelihood or impact\n- **Transfer**: Shift risk to a third party (insurance, contract terms, supplier guarantees)\n- **Accept**: Acknowledge and monitor (with trigger conditions for escalation)\n- **Avoid**: Change the plan to eliminate the risk entirely"
}
```

---

## Seed Templates

Include these starter templates in `context/seed-templates.json`:

### MS1 Product Requirements Document
```json
{
  "name": "MS1 Product Requirements Document",
  "slug": "ms1-prd",
  "icon_emoji": "📋",
  "category": "prd",
  "format": "markdown",
  "content": "# [Product Name] — MS1 Product Requirements Document\n\n**Version:** 1.0  \n**Author:**  \n**Date:**  \n**Status:** Draft\n\n---\n\n## 1. Executive Summary\n<!-- 1-2 paragraphs. State the problem, the proposed solution, the target user, and the expected business outcome. Be specific enough that someone reading only this section understands what we're building and why. -->\n\n## 2. Problem Statement\n<!-- What pain point exists? Who experiences it? How do they currently cope? What evidence do we have that this is a real problem (customer feedback, support tickets, market data)? Why is now the right time to solve it? -->\n\n## 3. Target User\n<!-- Define the primary user persona. Include: demographics, psychographics, golf habits, technology comfort level, current products they use, and what they value. Be specific enough to make design and feature decisions. -->\n\n## 4. Feature Requirements\n<!-- Prioritized table of features. Every feature needs a priority, a clear description, and whether it's hardware, software, or both. -->\n\n| Feature | Priority | Description | HW/SW/Both | Acceptance Criteria |\n|---------|----------|-------------|------------|--------------------|\n| | P0 | | | |\n| | P0 | | | |\n| | P1 | | | |\n| | P1 | | | |\n| | P2 | | | |\n\n## 5. Technical Specifications\n\n### 5.1 Hardware\n<!-- Sensors, chipsets, wireless connectivity, battery, enclosure, mechanical constraints -->\n\n### 5.2 Software / App\n<!-- App features, API requirements, BLE communication, cloud services -->\n\n### 5.3 Firmware\n<!-- On-device processing, BLE services, OTA update requirements -->\n\n### 5.4 Integration Points\n<!-- Where hardware, firmware, and software must synchronize. Define interfaces. -->\n\n## 6. User Stories\n<!-- Minimum 8 user stories covering all P0 features and key P1 features. Use format: As a [user], I want to [action] so that [outcome]. Include acceptance criteria for each. -->\n\n## 7. Development Timeline\n\n| Phase | Duration | Key Milestones | Dependencies |\n|-------|----------|---------------|-------------|\n| Concept | Weeks 1-4 | | |\n| EVT | Weeks 5-16 | | |\n| DVT | Weeks 17-28 | | |\n| PVT | Weeks 29-38 | | |\n| MP | Weeks 39+ | | |\n\n<!-- Include software milestones aligned to hardware gates. Flag long-lead components. -->\n\n## 8. Bill of Materials (Estimated)\n\n| Component | Specification | Unit Cost | Lead Time | Supplier | Source Risk |\n|-----------|--------------|-----------|-----------|----------|-------------|\n| | | $ | weeks | | Low/Med/High |\n| **Total BOM** | | **$** | | | |\n\n**Non-BOM Costs:**\n- NRE: $\n- Tooling: $\n- Certification (FCC/CE/IC): $\n- Test fixtures: $\n\n**Target Retail Price:** $  \n**Target Margin:** %\n\n## 9. Competitive Landscape\n<!-- Top 3-5 competitors. For each: product name, price, key specs, strengths, weaknesses, and how we differentiate. -->\n\n| Competitor | Product | Price | Key Differentiator | Our Advantage |\n|------------|---------|-------|--------------------|---------------|\n| | | $ | | |\n\n## 10. Risks & Mitigations\n\n| Risk | Category | Likelihood | Impact | Score | Mitigation |\n|------|----------|------------|--------|-------|------------|\n| | | /5 | /5 | | |\n\n## 11. Success Metrics\n<!-- Quantifiable KPIs. How do we know this product succeeded? Include targets and measurement method. -->\n\n| Metric | Target | Measurement Method | Timeframe |\n|--------|--------|-------------------|----------|\n| | | | |\n\n## 12. Open Questions\n<!-- Decisions still needed. Who owns each decision and by when. -->\n\n| Question | Owner | Decision Deadline |\n|----------|-------|------------------|\n| | | |\n\n---\n\n## Approval\n\n| Role | Name | Date | Signature |\n|------|------|------|-----------|\n| Product Manager | | | |\n| Engineering Lead | | | |\n| Design Lead | | | |"
}
```

### Competitive Analysis Matrix
```json
{
  "name": "Competitive Analysis Matrix",
  "slug": "competitive-analysis-matrix",
  "icon_emoji": "⚔️",
  "category": "analysis",
  "format": "markdown",
  "content": "# Competitive Analysis: [Product Category]\n\n**Prepared by:**  \n**Date:**  \n**Market Segment:**\n\n---\n\n## Overview\n<!-- 2-3 sentences framing the competitive landscape. What's the state of the market? What trends are shaping competition? -->\n\n## Product Comparison\n\n| Dimension | Blue Tees [Product] | Competitor A | Competitor B | Competitor C |\n|-----------|--------------------|--------------|--------------|--------------|\n| **Price (MSRP)** | | | | |\n| **Price (Street)** | | | | |\n| **Technology** | | | | |\n| **Accuracy** | | | | |\n| **Key Specs** | | | | |\n| **Connectivity** | | | | |\n| **Battery Life** | | | | |\n| **App Quality** | | | | |\n| **Setup Complexity** | | | | |\n| **Target Segment** | | | | |\n| **Distribution** | | | | |\n| **Subscription Required?** | | | | |\n\n## Competitor Deep Dives\n\n### Competitor A: [Name]\n<!-- 3-5 sentences. What they do well. Where they're weak. Recent moves (new products, pricing changes, partnerships). Threat level to Blue Tees. -->\n\n### Competitor B: [Name]\n<!-- Same structure -->\n\n### Competitor C: [Name]\n<!-- Same structure -->\n\n## Pricing Analysis\n<!-- How are competitors pricing? What's the price-to-value relationship? Where is there room in the market? -->\n\n## Feature Gap Analysis\n<!-- What do competitors offer that we don't? What do we offer that they don't? Which gaps matter most to our target user? -->\n\n| Feature Gap | Who Has It | Impact on Our Users | Priority to Address |\n|-------------|-----------|--------------------|-----------|\n| | | High/Med/Low | |\n\n## Strategic Implications\n<!-- What does this mean for Blue Tees? 3-5 actionable insights. -->\n\n1. \n2. \n3. \n\n## Sources\n<!-- List all sources used. URLs, dates accessed, and any caveats about data freshness. -->"
}
```

### Gate Review Checklist
```json
{
  "name": "Gate Review Checklist",
  "slug": "gate-review-checklist",
  "icon_emoji": "🚦",
  "category": "review",
  "format": "markdown",
  "content": "# Gate Review: [Gate Name] — [Product Name]\n\n**Date:**  \n**Reviewer:**  \n**Gate:** EVT / DVT / PVT / MP *(select one)*  \n**Recommendation:** Pass / Pass with Conditions / Fail *(select one)*\n\n---\n\n## Hardware Readiness\n\n- [ ] All P0 hardware features functional\n- [ ] Performance meets specification (attach test data)\n- [ ] BOM finalized and all components sourced\n- [ ] No single-source components without mitigation plan\n- [ ] Mechanical design validated (fit, finish, durability)\n- [ ] Battery life meets specification (attach test data)\n- [ ] Environmental testing complete (temperature, humidity)\n- [ ] Regulatory pre-scan completed (FCC/CE/IC)\n\n## Firmware Readiness\n\n- [ ] BLE connectivity stable (pairing, data transfer, reconnection)\n- [ ] Sensor data pipeline validated against ground truth\n- [ ] OTA update mechanism tested\n- [ ] Power management states implemented and verified\n- [ ] Error handling and recovery tested\n- [ ] Firmware version management in place\n\n## Software/App Readiness\n\n- [ ] App connects to device reliably\n- [ ] Core user flows complete and tested\n- [ ] Data accuracy validated end-to-end (sensor → firmware → BLE → app → display)\n- [ ] Offline behavior handled gracefully\n- [ ] Analytics instrumented for key events\n\n## Quality\n\n- [ ] Test plan executed with results documented\n- [ ] Known bugs cataloged with severity ratings\n- [ ] No P0 bugs open\n- [ ] P1 bugs have timeline for resolution\n- [ ] User testing completed (minimum 5 users) with findings documented\n\n## Business Readiness\n\n- [ ] Cost targets met (BOM within budget)\n- [ ] Timeline on track (or deviation explained with recovery plan)\n- [ ] Competitive position validated (no major market shifts since MS1)\n- [ ] Packaging and documentation in progress\n- [ ] Marketing/launch plan drafted\n\n## Open Issues\n\n| Issue | Severity | Owner | Resolution Plan | ETA |\n|-------|----------|-------|----------------|-----|\n| | | | | |\n\n## Conditions for Pass (if applicable)\n<!-- List specific conditions that must be met before proceeding to next gate -->\n\n1. \n2. \n\n## Notes\n<!-- Any additional context, observations, or recommendations -->"
}
```

---

## Starter Agent-Skill-Template Assignments

When seeding the database, assign skills and templates to starter agents:

| Agent | Skills (mode) | Templates |
|-------|--------------|-----------|
| PRD Drafter | Market Sizing (on_demand), BOM Estimation (on_demand), User Story Writing (on_demand), Risk Assessment (on_demand) | MS1 PRD, Gate Review Checklist |
| Competitive Intel | Market Sizing (always_on) | Competitive Analysis Matrix |
| Brand Voice | *(none)* | *(none)* |
| Tech Spec Writer | BOM Estimation (on_demand) | *(none — tech spec template is a good future addition)* |
| QA Reviewer | Risk Assessment (always_on) | Gate Review Checklist |
