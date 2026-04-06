import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { spawn } from 'node:child_process';

export const canvasRouter = new Hono();

const SYSTEM_PROMPT = `You are a code graph organizer. Given a function call graph and a user request, respond ONLY with newline-delimited JSON objects. Each object must have a "type" field. Valid types: create-group, add-to-group, move-node, add-annotation, clear-group. Output one command per line. No explanation, no markdown.`;

canvasRouter.post('/api/agent/canvas', async (c) => {
  const body = await c.req.json();
  const lightFns = (body.graph?.functions ?? []).slice(0, 100).map((f: Record<string, unknown>) => ({
    id: f.id, name: f.name, category: f.category, filePath: f.filePath
  }));
  const graphJson = JSON.stringify({ functions: lightFns, edges: body.graph?.edges ?? [], layout: body.graph?.canvasLayout ?? {} });
  const fullPrompt = `${SYSTEM_PROMPT}\n\nGraph:\n${graphJson}\n\nRequest: ${body.prompt}`;

  return new Promise<Response>((resolve) => {
    const child = spawn('claude', ['-p', fullPrompt], { stdio: ['ignore', 'pipe', 'pipe'] });

    child.on('error', (err: NodeJS.ErrnoException) => {
      resolve(c.json({ error: err.code === 'ENOENT' ? 'claude CLI not found' : err.message }, err.code === 'ENOENT' ? 503 : 500));
    });

    child.on('spawn', () => {
      c.header('Content-Type', 'application/x-ndjson');
      resolve(
        stream(c, async (s) => {
          for await (const chunk of child.stdout!) await s.write(chunk);
        })
      );
    });
  });
});
