import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { spawn } from 'node:child_process';
import type { AgentCommand } from '@agent-monitor/types';

export const agentRouter = new Hono();

agentRouter.post('/api/agent/run', async (c) => {
  const command = await c.req.json<AgentCommand>();

  const child = spawn('claude', ['-p', command.prompt], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Check for spawn error (ENOENT)
  return new Promise<Response>((resolve) => {
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        resolve(c.json({ error: 'claude CLI not found' }, 503));
      } else {
        resolve(c.json({ error: err.message }, 500));
      }
    });

    // If spawn succeeds, the 'spawn' event fires
    child.on('spawn', () => {
      c.header('Content-Type', 'text/plain');
      resolve(
        stream(c, async (s) => {
          const readable = child.stdout!;
          for await (const chunk of readable) {
            await s.write(chunk);
          }
        })
      );
    });
  });
});
