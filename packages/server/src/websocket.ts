import type { Hono } from 'hono';
import type { WSContext } from 'hono/ws';
import { createNodeWebSocket } from '@hono/node-ws';
import type { WsMessage } from '@agent-monitor/types';
import { getAllFunctions, getAllFiles, upsertFunction, removeFunction, upsertFile } from './store.js';

type ClientType = 'sdk' | 'dashboard';

const clients = new Set<WSContext>();
const clientTypes = new WeakMap<object, ClientType>();

export function setupWebSocket(app: Hono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  const wsHandler = upgradeWebSocket(() => ({
    onOpen(_evt, ws) {
      clients.add(ws);
    },
    onMessage(evt, ws) {
      const data = JSON.parse(typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data as ArrayBuffer));

      if (data.type === 'sdk-hello') {
        clientTypes.set(ws, 'sdk');
        return;
      }

      if (data.type === 'dashboard-hello') {
        clientTypes.set(ws, 'dashboard');
        const snapshot: WsMessage = {
          type: 'state-snapshot',
          payload: { functions: getAllFunctions(), files: getAllFiles() },
        };
        ws.send(JSON.stringify(snapshot));
        return;
      }

      if (clientTypes.get(ws) === 'sdk') {
        handleSdkMessage(data as WsMessage);
      }
    },
    onClose(_evt, ws) {
      clients.delete(ws);
    },
  }));

  return { injectWebSocket, wsHandler };
}

function handleSdkMessage(msg: WsMessage): void {
  switch (msg.type) {
    case 'function-discovered':
    case 'function-updated':
      upsertFunction(msg.payload);
      break;
    case 'function-removed':
      removeFunction(msg.payload.id);
      break;
    case 'file-changed':
      upsertFile(msg.payload);
      break;
  }
  broadcast(msg);
}

function broadcast(msg: WsMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (clientTypes.get(ws) === 'dashboard') {
      ws.send(data);
    }
  }
}
