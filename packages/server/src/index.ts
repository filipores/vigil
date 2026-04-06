import { serve } from '@hono/node-server';
import { app, injectWebSocket } from './app.js';

const server = serve({ fetch: app.fetch, port: 3001 });
injectWebSocket(server);

console.log('Agent Monitor server running on http://localhost:3001');
