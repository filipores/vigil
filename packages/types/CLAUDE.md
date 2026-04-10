# @agent-monitor/types

Shared type definitions — the contract layer consumed by all other packages.

## File map

- `function.ts` — `FunctionInfo`, `FunctionParam`, `FunctionCategory` (the core entity representing a discovered function)
- `dataflow.ts` — `DataFlowEdge`, `EdgeType` (call/data/import edges between functions)
- `file.ts` — `FileChange`, `FileChangeType` (file-level change tracking)
- `messages.ts` — `WsMessage` union and its variants: `WsFunctionDiscovered`, `WsFunctionUpdated`, `WsFunctionRemoved`, `WsFileChanged`, `WsStateSnapshot`, `WsEdgesUpdated`
- `canvas.ts` — `CanvasLayout`, `PinnedPosition`, `CanvasGroup`, `CanvasAnnotation` (persistent canvas state)
- `canvas-command.ts` — `CanvasCommand` union: `CreateGroupCommand`, `AddToGroupCommand`, `MoveNodeCommand`, `AddAnnotationCommand`, `ClearGroupCommand`
- `command.ts` — `AgentCommand`, `AgentContext` (prompt + code context sent to agents)
- `git.ts` — `GitCommit`, `FileDiff`, `DiffLine`, `DiffLineType`, `CommitDiff`
- `index.ts` — Barrel re-exports from all modules

## Export pattern

Named `export type` only — no default exports, no runtime values.
Everything re-exported through `index.ts` via `export type { ... } from './module.js'`.

## Build

```
pnpm build        # tsc -b (composite project references from root tsconfig)
pnpm dev          # tsc -b --watch
```

Compiles to ESM (`dist/`) with `.d.ts` declarations. Consumed via `@agent-monitor/types` workspace alias.

## Adding a new type

1. Create `src/your-thing.ts`, define and export your types
2. Add `export type { ... } from './your-thing.js'` in `src/index.ts`
3. Rebuild — consumers pick it up automatically

## Extending WsMessage

Add a new interface in `messages.ts` following the discriminated union pattern:

```ts
export interface WsYourEvent {
  type: 'your-event';
  payload: YourPayload;
}
```

Then add `WsYourEvent` to the `WsMessage` union. Handle it in:
- `server/websocket.ts` (broadcast)
- `dashboard/useFunctions.ts` (client-side dispatch)

## Key types

| Type | What it is |
|------|-----------|
| `FunctionInfo` | Core entity — a parsed function with id, name, file, params, returnType, category |
| `DataFlowEdge` | Directed edge (sourceId -> targetId) with EdgeType and label |
| `FileChange` | Tracked file mutation with associated function ids |
| `WsMessage` | Discriminated union of all WebSocket events (switch on `.type`) |
| `CanvasCommand` | Discriminated union of canvas mutations (groups, positions, annotations) |
| `AgentCommand` | Prompt + AgentContext (snippet, file, line range) for agent invocations |
