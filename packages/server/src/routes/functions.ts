import { Hono } from 'hono';
import { getAllFunctions, getFunction } from '../store.js';

export const functionsRouter = new Hono();

functionsRouter.get('/api/functions', (c) => {
  return c.json(getAllFunctions());
});

functionsRouter.get('/api/functions/:id', (c) => {
  const fn = getFunction(c.req.param('id'));
  if (!fn) return c.json({ error: 'not found' }, 404);
  return c.json(fn);
});
