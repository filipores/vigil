import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setupWebSocket } from './websocket.js';
import { functionsRouter } from './routes/functions.js';
import { filesRouter } from './routes/files.js';
import { editorRouter } from './routes/editor.js';
import { agentRouter } from './routes/agent.js';

const app = new Hono();

app.use('*', cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));

const { injectWebSocket, wsHandler } = setupWebSocket(app);

app.route('/', functionsRouter);
app.route('/', filesRouter);
app.route('/', editorRouter);
app.route('/', agentRouter);
app.get('/ws', wsHandler);

export { app, injectWebSocket };
