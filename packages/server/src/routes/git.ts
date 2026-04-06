import { Hono } from 'hono';
import { getCommits, getCommitDiff } from '../git.js';

export const gitRouter = new Hono();

gitRouter.get('/api/git/commits', async (c) => {
  const root = process.env.MONITOR_ROOT;
  if (!root) return c.json({ error: 'MONITOR_ROOT not set' }, 503);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  try {
    const commits = await getCommits(root, limit);
    return c.json(commits);
  } catch {
    return c.json({ error: 'Failed to read git log' }, 500);
  }
});

gitRouter.get('/api/git/commits/:hash/diff', async (c) => {
  const root = process.env.MONITOR_ROOT;
  if (!root) return c.json({ error: 'MONITOR_ROOT not set' }, 503);
  const hash = c.req.param('hash');
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return c.json({ error: 'Invalid hash' }, 400);
  try {
    const diff = await getCommitDiff(root, hash);
    return c.json(diff);
  } catch {
    return c.json({ error: 'Failed to read git diff' }, 500);
  }
});
