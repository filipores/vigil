import { Hono } from 'hono';
import { getCommits, getCommitDiff } from '../git.js';

export const gitRouter = new Hono();

const getRoot = () => process.env.MONITOR_ROOT || process.cwd();

gitRouter.get('/api/git/commits', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  try {
    const commits = await getCommits(getRoot(), limit);
    return c.json(commits);
  } catch {
    return c.json({ error: 'Failed to read git log' }, 500);
  }
});

gitRouter.get('/api/git/commits/:hash/diff', async (c) => {
  const hash = c.req.param('hash');
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return c.json({ error: 'Invalid hash' }, 400);
  try {
    const diff = await getCommitDiff(getRoot(), hash);
    return c.json(diff);
  } catch {
    return c.json({ error: 'Failed to read git diff' }, 500);
  }
});
