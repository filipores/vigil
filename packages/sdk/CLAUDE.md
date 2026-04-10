# @agent-monitor/sdk

File watcher + AST parser SDK. Runs inside a target codebase, watches TS/JS files for changes, extracts functions and call edges via SWC, and streams granular events to the server over WebSocket.

## Entry point

`monitor({ root })` from `src/index.ts`. Creates a `WsClient` and `FileWatcher`, returns `{ stop }`. Default globs: `**/*.{ts,tsx,js,jsx}`, ignores `node_modules/`, `dist/`, `.next/`.

## Key modules

- **FileWatcher** (`watcher.ts`) — chokidar watcher with 150ms debounce per file. Tracks `Map<filePath, FunctionInfo[]>` and `Map<filePath, DataFlowEdge[]>` for diffing. Emits `function-discovered`, `function-updated`, `function-removed`, `edges-updated`, `file-changed`.
- **WsClient** (`client.ts`) — WebSocket client (`ws://localhost:3001/ws`). Queues messages while disconnected. Reconnects with exponential backoff (1s initial, 30s cap). Sends `sdk-hello` on open, then drains queue.
- **parseFile** (`parser.ts`) — Reads file, runs `@swc/core` `parseSync` (TSX-aware), walks AST body for `FunctionDeclaration`, `VariableDeclaration` (arrow/fn expressions), `ClassDeclaration` (methods), and export wrappers. Also extracts intra-file call edges via `collectCallsInBody`.
- **extractor.ts** — `SourceMapper` (byte offset to line/col via binary search), `extractJsDoc`, `extractParamType` (handles rest, destructuring, defaults), `extractReturnType`.
- **categorize.ts** — Regex heuristics, first match wins: `class-method` > `hook` (`use[A-Z]`) > `component` (capitalized + tsx/jsx) > `handler` (`handle*/on*/...Handler`) > `api` (path or verb prefix) > `util` (utils/helpers path) > `async` > `function`.
- **utils.ts** — `generateId`: SHA1 of `filePath:name:line`, truncated to 12 hex chars. `normalizePath`: `path.resolve`.

## Data flow

```
file change → parseFile(abs) → { functions: FunctionInfo[], edges: DataFlowEdge[] }
  → diff against previous FunctionInfo[] by id
  → emit discovered/updated/removed per function
  → emit edges-updated for the file
  → emit file-changed with type added|modified|deleted
```

## Build

`tsc -b` (composite project, references `../types`). Output in `dist/`.

## Extending

**New event type:** define in `@agent-monitor/types` `WsMessage`, emit from `watcher.ts` via `this.client.send()`.

**New metadata on functions:** extend `FunctionInfo` in types, populate in `parser.ts` (`extractFunction` / `walkNode`), diff in `watcher.ts` `handleFileChange`.

**New file types:** add glob to `DEFAULT_INCLUDE` in `monitor.ts`, handle syntax option in `parseFile`.
