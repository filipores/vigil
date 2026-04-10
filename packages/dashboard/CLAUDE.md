# Dashboard Package

Vite + Svelte 5 single-page app. Connects to the vigil server (port 3001) via WebSocket and REST. Renders a D3 force-directed graph of tracked functions on an HTML5 Canvas. Runs on port 3000.

## Stack

Svelte 5 with runes ($state, $derived, $effect), Vite 6, Tailwind v4 with CSS-first config (`@import "tailwindcss"` + `@theme` block in `app.css`), D3 force simulation on Canvas 2D, IBM Plex Mono + DM Sans via Google Fonts `<link>`. Types come from `@agent-monitor/types`.

## Layout

`App.svelte` renders `WorkspaceLayout`, which composes the entire UI:
- **Left sidebar** (w-56) — `SidebarTabs` switches between file tree and commit list.
- **Center** — `FunctionGraph` renders the D3 canvas. In commits mode, swaps to `DiffView`.
- **Right** — `DetailPanel` slides in on node selection. Shows params, return type, source, backlinks.
- **Modals** — `AgentModal` for ask-agent queries; `CanvasAgentPanel` for layout commands in canvas mode.

## Component Map

- `Graph/` — `FunctionGraph.svelte` (canvas element + resize observer), `forceGraph.ts` (imperative simulation + rendering module)
- `Sidebar/` — `SidebarTabs.svelte` (files / commits tab switcher)
- `FileTree/` — `FileTree.svelte`, `FileTreeNode.svelte`, `CategoryFilter.svelte`, `computeCommonRoot.ts`
- `Detail/` — `DetailPanel.svelte`, `CodePreview.svelte` (selected function inspector)
- `Commits/` — `CommitList.svelte`, `DiffView.svelte` (git history and diffs)
- `Agent/` — `AgentModal.svelte` (streaming agent Q&A), `CanvasAgentPanel.svelte` (layout agent harness), `AgentForm.svelte`
- `Analysis/` — `AnalysisSection.svelte`, `AnalysisBadge.ts` (pure Canvas2D draw function)
- `Search/` — `SearchPalette.svelte` (Cmd+K fuzzy search)

## State Management

All state lives in `.svelte.ts` files under `lib/stores/`, using Svelte 5 runes:
- `functions.svelte.ts` — primary state: `functionsMap`, `files`, `edges`. Handles all WS message types.
- `websocket.svelte.ts` — WebSocket lifecycle, auto-reconnect on close (2s delay). Returns `connected`.
- `analysis.svelte.ts` — analysis results and active runs. Handles analysis WS messages.
- `graphScope.svelte.ts` — scope mode (all/focus/commit/category) with BFS computation.
- `gitCommits.svelte.ts` — commit list, diff fetching, highlighted function IDs from changed files.
- `canvasLayout.svelte.ts` — persists pinned node positions, groups, annotations to `localStorage`.

Each store exports getter functions that return objects with reactive getters (to preserve Svelte 5 reactivity across module boundaries) plus action functions.

## Design System

oklch color palette defined as CSS custom properties in `app.css` `@theme` block:
- `--color-void` (background), `--color-surface`, `--color-surface-raised`, `--color-surface-bright`
- `--color-signal` (cyan accent), `--color-signal-dim`, `--color-signal-glow`
- `--color-warm` (amber accent), `--color-warm-dim`
- `--color-text`, `--color-text-secondary`, `--color-text-dim`
- `--color-border`, `--color-border-subtle`

Tailwind maps these directly: `bg-void`, `text-signal`, `border-border-subtle`, etc.

## API Layer

`lib/api.ts` exports all `fetch()` wrappers: `fetchFunctions`, `fetchFiles`, `fetchEdges`, `fetchCommits`, `fetchCommitDiff`, `openInEditor`, `runAgent`, `runCanvasAgent`. `lib/constants.ts` defines `WS_URL` and `API_BASE`, overridable via `VITE_WS_URL` / `VITE_API_BASE`.

## How To

**Add a component.** Create `.svelte` file in `components/`, use `$props()` for inputs, `$state`/`$derived`/`$effect` for reactivity, Tailwind for styling. Wire into `WorkspaceLayout.svelte`.

**Handle a new WS message.** Add a case in `functions.svelte.ts` `handleFunctionsMessage` switch statement. The `WsMessage` union type lives in `@agent-monitor/types`.

**Add reactive state.** Create a `.svelte.ts` file in `lib/stores/`. Use `$state()` for mutable state, `$derived()` for computed values. Export getter functions with reactive accessors.

## Graph Rendering

`forceGraph.ts` is a plain imperative module that exports `createForceGraph(opts)` returning `{ update, updateCallbacks, destroy }`. It runs a D3 `forceSimulation` and draws every tick to a Canvas 2D context. Forces: charge (-180), center, collide (48px), link (distance 120). Nodes render as circles with label text. Edges draw as lines between nodes. In canvas mode, pointer events handle drag-to-pin (persisted via `onNodeDrag` callback). In default mode, click-to-select only. Groups and annotations from `CanvasLayout` render as rounded rects behind nodes. `FunctionGraph.svelte` wires this into Svelte lifecycle via `onMount`/`onDestroy` and feeds reactive data through `$effect`.
