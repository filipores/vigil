import { Hono } from 'hono';
import { getAllFiles } from '../store.js';

export const filesRouter = new Hono();

filesRouter.get('/api/files', (c) => {
  return c.json(getAllFiles());
});
