# Server Package

Hono HTTP + WebSocket server on port 3001. Brokers state between the SDK (which instruments user code) and the dashboard (which visualizes it). All state lives in memory; no database, no persistence. Also spawns Claude CLI subprocesses for agent features.

## Architecture

`index.ts` creates the HTTP server via `@hono/node-server` and injects WebSocket support. `app.ts` builds the Hono app, applies CORS (origins `localhost:3000` and `localhost:3001`), mounts all route files at `/`, and exposes the `/ws` endpoint.

## Store (`store.ts`)

Three module-level Maps: `functions` (keyed by id), `files` (keyed by filePath), `fileEdges` (keyed by filePath). State is rebuilt from the SDK on each WebSocket reconnect.

Exports: `getAllFunctions`, `getFunction`, `upsertFunction`, `removeFunction`, `getAllFiles`, `upsertFile`, `upsertFileEdges`, `removeFileEdges`, `getAllEdges`, `clearStore`.

## WebSocket (`websocket.ts`)

Client registry: `Set<WSContext>` for all connections, `WeakMap` for type-tagging each as `sdk` or `dashboard`. Handshake messages `sdk-hello` and `dashboard-hello` set the tag. On `dashboard-hello`, the server sends a `state-snapshot` with all functions, files, and edges.

SDK messages hit `handleSdkMessage`, a switch on `msg.type`: `function-discovered`, `function-updated` (both upsert), `function-removed`, `file-changed`, `edges-updated`. Each case updates the store then broadcasts to all dashboard clients.

## Routes

| File | Method | Path | Description |
|------|--------|------|-------------|
| `functions.ts` | GET | `/api/functions` | All functions |
| `functions.ts` | GET | `/api/functions/:id` | Single function (404 if missing) |
| `functions.ts` | GET | `/api/edges` | All data-flow edges |
| `files.ts` | GET | `/api/files` | All file changes |
| `editor.ts` | POST | `/api/editor/open` | Opens file in VS Code via `code --goto` |
| `agent.ts` | POST | `/api/agent/run` | Streams Claude CLI output as `text/plain` |
| `canvas.ts` | POST | `/api/agent/canvas` | Streams Claude CLI output as `application/x-ndjson` |
| `git.ts` | GET | `/api/git/commits` | Recent commits (`?limit=`, max 100) |
| `git.ts` | GET | `/api/git/commits/:hash/diff` | Parsed unified diff for a commit |

## Agent Spawning

Both `agent.ts` and `canvas.ts` use `spawn('claude', ['-p', prompt], { stdio: ['ignore', 'pipe', 'pipe'] })`. Output is piped through Hono's `stream()` helper. ENOENT on the child process returns 503. No concurrency control, no timeout, no pid tracking.

`canvas.ts` prepends a system prompt instructing the model to emit newline-delimited JSON commands and truncates the graph payload to 100 functions.

## Adding a Route

Create a file in `src/routes/`, export a Hono router instance, mount it in `app.ts` with `app.route('/', yourRouter)`.

## Adding a WebSocket Message

Add a case in the `handleSdkMessage` switch in `websocket.ts`. Update the store, then `broadcast()` handles fan-out to dashboards. If the message carries new data, add corresponding store functions in `store.ts` and update the `state-snapshot` payload in the `dashboard-hello` handler.
