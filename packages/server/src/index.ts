import { serve } from '@hono/node-server';
import { app, injectWebSocket } from './app.js';
import { initAnalysisStore } from './analysis/index.js';

initAnalysisStore().catch((err) => {
  console.error('Failed to initialize analysis store:', err);
});

const server = serve({ fetch: app.fetch, port: 3001 });
injectWebSocket(server);

console.log('Vigil server running on http://localhost:3001');
