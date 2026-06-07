---
name: talos-ui-patterns
description: Talos OS Mission Control UI patterns — component conventions, styling, and design tokens
license: MIT
compatibility: opencode
metadata:
  audience: developer
  project: talos-os
---

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS 3.4
- React Flow (reactflow v11) for workflow builder
- Framer Motion for animations
- Lucide React for icons

## Design Tokens

- Theme: Bronze age / steampunk aesthetic
- Colors: bronze-{300,400}, gunmetal-{400,500,700}, cyan-500, gray-{400,500,600}
- Font: `font-display` for headings, `font-mono` for data/code
- Components use `panel`, `gear-border`, `scanlines`, `rune` CSS classes
- Status colors: idle (gray), bidding (yellow), executing (cyan), offline (red)
- Guild colors: crown (bronze), forge (orange), sanctum (cyan), vault (purple), foundry (green)

## Component Conventions

- All components use `"use client"` directive
- Components in `src/components/`
- Props typed with TypeScript interfaces
- Default demo data patterns (DEMO_AGENTS, DEMO_TASKS constants)
- Animation via Tailwind utility classes (`animate-pulse`, `animate-glow-pulse`)
- Layout: Header + Sidebar + Main + StatusBar

## Key Components

- `AgentGrid` — Grid of agent cards with guild icons, status dots, load bars
- `TaskFlowChart` — React Flow DAG for task visualization
- `Header` — Top bar with system status indicator
- `Sidebar` — Navigation panel with view switching
- `StatusBar` — Footer with CPU, memory, token usage
