import type { Hono } from 'hono';
import type { WSContext } from 'hono/ws';
import { createNodeWebSocket } from '@hono/node-ws';
import type { WsMessage } from '@agent-monitor/types';
import { getAllFunctions, getAllFiles, getAllEdges, upsertFunction, removeFunction, upsertFile, upsertFileEdges } from './store.js';
import { getAutoAnalysis } from './analysis/autoInstance.js';
import { AnalysisEngine, getAllAnalyses, setAnalysisEngine } from './analysis/index.js';
import { createAutoAnalysis } from './analysis/auto.js';
import { setAutoAnalysis } from './analysis/autoInstance.js';

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
        const snapshot = {
          type: 'state-snapshot' as const,
          payload: { functions: getAllFunctions(), files: getAllFiles(), edges: getAllEdges(), analyses: getAllAnalyses() },
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

  // Instantiate the analysis engine with access to broadcast
  const engine = new AnalysisEngine(broadcast);
  setAnalysisEngine(engine);

  // Set up auto-analysis
  const autoAnalysis = createAutoAnalysis(engine);
  setAutoAnalysis(autoAnalysis);

  return { injectWebSocket, wsHandler };
}

function handleSdkMessage(msg: WsMessage): void {
  switch (msg.type) {
    case 'function-discovered':
    case 'function-updated':
      upsertFunction(msg.payload);
      getAutoAnalysis()?.onFunctionEvent(msg.payload.id);
      break;
    case 'function-removed':
      removeFunction(msg.payload.id);
      break;
    case 'file-changed':
      upsertFile(msg.payload);
      break;
    case 'edges-updated':
      upsertFileEdges(msg.payload.filePath, msg.payload.edges);
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
