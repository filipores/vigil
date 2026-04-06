import { Hono } from 'hono';
import { spawn } from 'node:child_process';

export const editorRouter = new Hono();

editorRouter.post('/api/editor/open', async (c) => {
  const { filePath, line } = await c.req.json<{ filePath: string; line: number }>();

  return new Promise<Response>((resolve) => {
    const child = spawn('code', ['--goto', `${filePath}:${line}:1`], { stdio: 'ignore' });

    child.on('error', (err) => {
      resolve(c.json({ error: err.message }, 500));
    });

    child.on('close', () => {
      resolve(c.json({ ok: true }));
    });
  });
});
