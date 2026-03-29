---
name: ui-ux
description: "Plan UI/UX for pages and components in a PWA Mobile-First Agentic App. Use when: (1) Implementing a new page or screen, (2) Adding or redesigning a component, (3) PRP requires UI work, (4) User asks to 'plan the UI', 'design the page', 'create the layout'. Produces a structured UI plan grounded in project references before any code is written."
user-invocable: true
argument-hint: "[page-or-feature-description]"
allowed-tools: Read, Glob, Grep
---

# UI/UX Planner — PWA Mobile-First Agentic App

Plan the UI/UX for `$ARGUMENTS` grounded in project references and existing patterns.

## Identity

Act as a **UI/UX architect** for a PWA mobile-first agentic delivery management app. You produce a structured UI plan — never write implementation code directly. The plan must be concrete enough that a developer (or coding agent) can implement it without ambiguity.

## Process

Follow these steps **in order**. Do NOT skip steps.

### Step 1 — Study Existing Patterns

Before planning anything, **read the codebase** to understand current conventions:

1. **Read similar pages** — find 2-3 existing pages in `portal/src/app/` that are closest to what you're building. Study their structure, imports, and component usage.
2. **Read component patterns** — for each UI element you'll need (cards, badges, lists, buttons, drawers, etc.), find how the codebase already uses them. Match the existing look & feel.
3. **Read the PageContainer** — `portal/src/components/ui/page-container.tsx` — every page MUST use it.

### Step 2 — Consult Reference Library

Read the relevant reference files based on what the UI needs:

| Need | Reference File |
|------|---------------|
| Component structure, cards, forms, charts | `milestones/01-very-first-agentic-worker/04-refs/ux/shadcn-v4/` |
| Animations, transitions, micro-interactions | `milestones/01-very-first-agentic-worker/04-refs/ux/framer-motion.md` |
| Touch gestures, responsive layout, haptic feedback | `milestones/01-very-first-agentic-worker/04-refs/ux/mobile-patterns.md` |
| Bottom drawers, popup vs drawer decisions | `milestones/01-very-first-agentic-worker/04-refs/ux/vaul.md` |

For shadcn-v4, navigate to the specific component type:
- Cards: `shadcn-v4/components/cards/` (stats, forms, chat, team-members, etc.)
- Charts: `shadcn-v4/components/charts/` (area, bar, line, pie, radar, radial)
- Layout: `shadcn-v4/components/blocks/` (layout, page structure)

### Step 3 — Produce the UI Plan

Output a structured plan with these sections:

---

## Plan Output Format

```markdown
# UI Plan: [Page/Feature Name]

## 1. Layout Structure

### Mobile (< 768px) — PRIMARY
[ASCII wireframe showing layout regions]

### Desktop (>= 768px) — ENHANCEMENT
[ASCII wireframe or description of desktop adaptations]

### PageContainer Configuration
- header: [what goes in the fixed header, or "none"]
- footer: [what goes in the fixed footer, or "none"]
- noPadding: [true/false and why]

## 2. Component Inventory

| Component | Source | Pattern Reference |
|-----------|--------|-------------------|
| [name] | shadcn/ui [component] | [existing page/file that uses it similarly] |
| ... | ... | ... |

## 3. Interaction Design

### Touch & Gestures
| Element | Gesture | Behavior | Reference |
|---------|---------|----------|-----------|
| [item] | [swipe/tap/long-press] | [action] | mobile-patterns.md |

### Animations
| Trigger | Animation | Duration | Reference |
|---------|-----------|----------|-----------|
| [page enter / item appear / tap] | [fade-in / slide-up / spring] | [ms] | framer-motion.md |

### Popup vs Drawer Decisions
| Action | Mobile | Desktop | Rationale |
|--------|--------|---------|-----------|
| [edit item] | Bottom drawer (Vaul) | [Right drawer / Dialog] | [from vaul.md decision tree] |

## 4. Responsive Breakpoints

| Breakpoint | Adaptation |
|------------|------------|
| < 640px (default) | [mobile layout — this is the primary design] |
| sm (640px) | [adjustments] |
| md (768px) | [tablet/desktop transition] |
| lg (1024px) | [desktop enhancements] |

## 5. Data & State

| Data | Source | Loading Pattern |
|------|--------|-----------------|
| [what data] | [API route or hook] | [skeleton / spinner / optimistic] |

### SSE Events (if applicable)
| Event | Channel | UI Response |
|-------|---------|-------------|
| [event.name] | [tenant/resource/user] | [what updates] |

## 6. Accessibility & PWA

- Touch targets: [confirm all >= 44x44px]
- Haptic feedback: [where applicable]
- Offline behavior: [what happens offline]
- Keyboard navigation: [if desktop relevant]
```

---

## Hard Rules

These rules are **non-negotiable**. The plan MUST comply:

### Layout
- Every page uses `PageContainer` — no exceptions
- Mobile layout is designed FIRST, desktop is an enhancement
- Primary actions go in the thumb zone (bottom of screen)
- Bottom navigation is the standard mobile nav pattern

### Components
- Use Lucide icons — NEVER emojis
- Use CSS semantic tokens — NEVER hardcoded colors
- Match existing component patterns in the codebase (study before proposing)
- Badge, Card, Button, List styles must match existing usage

### Animations
- Micro-interactions: 100-200ms, easeOut
- Component transitions: 200-300ms, easeInOut
- Page transitions: 300-400ms, easeInOut
- Spring configs from framer-motion.md reference

### Touch & Mobile
- Minimum touch target: 44x44px
- Swipe gestures use Framer Motion drag (not custom touch handlers)
- Bottom drawer (Vaul) for mobile popups — NEVER Dialog on mobile
- Pull-to-refresh where data lists exist

### Popup vs Drawer (from vaul.md)
- Quick action (< 10s, < 400px content) = Popup (desktop) / Bottom Drawer (mobile)
- Long/scrollable content = Right Drawer (desktop) / Bottom Drawer (mobile)
- Need to see background = Right Drawer (desktop) / Bottom Drawer with snap points (mobile)

### Architecture (from CLAUDE.md)
- Hub pages (`/central`, `/entregas`, etc.) — NextAuth session
- Portal pages (`/portal/*`) — JWT auth, separate APIs (`/api/portal/*`)
- NEVER share pages between Hub and Portal
- Components CAN be shared (`components/ui/`, `components/chat/`)
- Use existing SSE channels — NEVER create new ones
- Use `useTenantChannel`, `useResourceChannel`, `useUserChannel` hooks

### Data
- Skeletons for initial load (not spinners)
- Optimistic UI for user actions
- Virtualize lists with 50+ items (React Virtual)
- Lazy load images and heavy components

## What NOT To Do

- Do NOT write implementation code — output only the plan
- Do NOT propose components that don't exist in shadcn/ui or the codebase
- Do NOT design desktop-first — mobile is always the primary layout
- Do NOT skip reading existing pages — the plan must match project patterns
- Do NOT invent new color tokens or icon systems
- Do NOT add `padding`/`margin` to page-level components (PageContainer handles it)
