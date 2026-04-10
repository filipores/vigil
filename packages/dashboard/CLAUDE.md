# Dashboard Package

Next.js 15 / React 19 single-page app. Connects to the vigil server (port 3001) via WebSocket and REST. Renders a D3 force-directed graph of tracked functions on an HTML5 Canvas. Runs on port 3000.

## Stack

Next.js App Router (all components are `"use client"`), Tailwind v4 with CSS-first config (`@import "tailwindcss"` + `@theme` block in `globals.css`), D3 force simulation on Canvas 2D, IBM Plex Mono + DM Sans via `next/font/google`. Types come from `@agent-monitor/types`.

## Layout

`page.tsx` renders `WorkspaceLayout`, which composes the entire UI:
- **Left sidebar** (w-56) — `SidebarTabs` switches between file tree and commit list.
- **Center** — `FunctionGraph` renders the D3 canvas. In commits mode, swaps to `DiffView`.
- **Right** — `DetailPanel` slides in on node selection. Shows params, return type, source, backlinks.
- **Modals** — `AgentModal` for ask-agent queries; `CanvasAgentPanel` for layout commands in canvas mode.

## Component Map

- `Graph/` — `FunctionGraph` (canvas element + resize observer), `useForceGraph` (simulation + rendering)
- `Sidebar/` — `SidebarTabs` (files / commits tab switcher)
- `FileTree/` — `FileTree`, `CategoryFilter` (file browser with category filtering)
- `Detail/` — `DetailPanel`, `CodePreview` (selected function inspector)
- `Commits/` — `CommitList`, `DiffView` (git history and diffs)
- `Agent/` — `AgentModal` (streaming agent Q&A), `CanvasAgentPanel` (layout agent harness), `AgentForm`

## State Management

No Redux, Zustand, or Context. All state lives in hooks under `hooks/`:
- `useFunctions` — primary state: `functionsMap`, `files`, `edges`. Handles all WS message types.
- `useWebSocket` — WebSocket lifecycle, auto-reconnect on close (2s delay). Returns `connected`.
- `useGitCommits` — commit list, diff fetching, highlighted function IDs from changed files.
- `useCanvasLayout` — persists pinned node positions, groups, annotations to `localStorage`.

## Design System

oklch color palette defined as CSS custom properties in `globals.css` `@theme` block:
- `--color-void` (background), `--color-surface`, `--color-surface-raised`, `--color-surface-bright`
- `--color-signal` (cyan accent), `--color-signal-dim`, `--color-signal-glow`
- `--color-warm` (amber accent), `--color-warm-dim`
- `--color-text`, `--color-text-secondary`, `--color-text-dim`
- `--color-border`, `--color-border-subtle`

Tailwind maps these directly: `bg-void`, `text-signal`, `border-border-subtle`, etc.

## API Layer

`lib/api.ts` exports all `fetch()` wrappers: `fetchFunctions`, `fetchFiles`, `fetchEdges`, `fetchCommits`, `fetchCommitDiff`, `openInEditor`, `runAgent`, `runCanvasAgent`. `lib/constants.ts` defines `WS_URL` and `API_BASE`, overridable via `NEXT_PUBLIC_WS_URL` / `NEXT_PUBLIC_API_BASE`.

## How To

**Add a component.** Create file in `components/`, add `"use client"` directive, use hooks for state, Tailwind for styling. Wire into `WorkspaceLayout`.

**Handle a new WS message.** Add a case in `useFunctions.ts` `onMessage` switch statement. The `WsMessage` union type lives in `@agent-monitor/types`.

## Graph Rendering

`useForceGraph.ts` runs a D3 `forceSimulation` and draws every tick to a Canvas 2D context. Forces: charge (-180), center, collide (48px), link (distance 120). Nodes render as circles with label text. Edges draw as lines between nodes. In canvas mode, pointer events handle drag-to-pin (persisted via `onNodeDrag` → `useCanvasLayout`). In default mode, click-to-select only. Groups and annotations from `CanvasLayout` render as rounded rects behind nodes.
