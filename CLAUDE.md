# Vigil

Real-time monitoring dashboard for AI-generated code — watches a codebase via AST parsing, streams function data to a D3 force graph, and provides agent-powered analysis.

## Architecture

npm workspaces monorepo with TypeScript project references. Dependency order:

- **`@agent-monitor/types`** — Shared type definitions (functions, files, edges, WS messages, canvas, git)
- **`@agent-monitor/sdk`** — File watcher + SWC AST parser; connects to server via WebSocket
- **`@agent-monitor/server`** — Hono HTTP + WS server (port 3001); in-memory store, broadcasts to dashboards
- **`@agent-monitor/dashboard`** — Next.js 15 + React 19 app (port 3000); D3 force graph, Tailwind CSS 4

## Commands

```bash
npm install                  # install all workspaces
npm run build                # sequential: types → sdk → server → dashboard
npm run dev:server           # tsx watch src/index.ts (port 3001)
npm run dev:dashboard        # next dev --port 3000
npm run dev:types            # tsc -b --watch (rebuild types on change)
```

Run `dev:server` and `dev:dashboard` in separate terminals. Run `dev:types` if editing shared types.

## Data Flow

```
SDK → Server → Dashboard  (one-way)
```

1. SDK watches files with chokidar, parses AST with `@swc/core`
2. SDK sends WS events to server (port 3001)
3. Server stores in-memory (`store.ts`), broadcasts to all dashboard clients
4. Dashboard renders D3 force graph in real time

## WebSocket Protocol

### Handshake (untyped)
- SDK sends `{ type: "sdk-hello" }`
- Dashboard sends `{ type: "dashboard-hello" }` → server replies with `state-snapshot`

### WsMessage union (`@agent-monitor/types`)
| Type | Direction | Payload |
|------|-----------|---------|
| `function-discovered` | SDK → Server → Dashboard | `FunctionInfo` |
| `function-updated` | SDK → Server → Dashboard | `FunctionInfo` |
| `function-removed` | SDK → Server → Dashboard | `{ id: string }` |
| `file-changed` | SDK → Server → Dashboard | `FileChange` |
| `edges-updated` | SDK → Server → Dashboard | `{ filePath, edges: DataFlowEdge[] }` |
| `state-snapshot` | Server → Dashboard | `{ functions, files, edges }` |

Agent analysis uses HTTP streaming endpoints, not WebSocket.

## Key Types

Exported from `@agent-monitor/types`:
- `FunctionInfo`, `FunctionParam`, `FunctionCategory`
- `FileChange`, `FileChangeType`
- `DataFlowEdge`, `EdgeType`
- `CanvasLayout`, `CanvasCommand` (and sub-commands)
- `GitCommit`, `CommitDiff`, `FileDiff`
- `AgentContext`, `AgentCommand`

## Conventions

- ESM throughout (`"type": "module"`, `Node16` module resolution)
- No default exports in types package — all named exports
- Function IDs: 12-char SHA1 of `"filePath:name:line"`
- All dashboard components use `"use client"`
- State management via hooks only (no Redux/Zustand)
- No test framework — QA via `scripts/qa-loop.sh` (Playwright-based)
- Server framework: Hono with `@hono/node-ws`
- TypeScript strict mode, `ES2022` target

## End-to-End Change Recipe

When adding a feature that spans packages:

1. **types/** — Add/modify interfaces, extend `WsMessage` union if needed
2. **sdk/** — Add file-watching logic or new AST extraction
3. **server/** — Update `store.ts` + `handleSdkMessage` in `websocket.ts` + HTTP routes
4. **dashboard/** — Add hook in `hooks/`, component in `components/`, wire into page

Build order matters: `types` first, then `sdk`/`server` (parallel OK), then `dashboard`.
