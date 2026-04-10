import type { WsMessage } from '@agent-monitor/types';

let connected = $state(false);
let ws: WebSocket | null = null;
let messageHandler: ((msg: WsMessage) => void) | null = null;
let disposed = false;

function connect(url: string) {
  if (disposed) return;
  ws = new WebSocket(url);

  ws.onopen = () => {
    connected = true;
    ws!.send(JSON.stringify({ type: 'dashboard-hello' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WsMessage;
      messageHandler?.(msg);
    } catch {
      // ignore non-JSON messages
    }
  };

  ws.onclose = () => {
    connected = false;
    if (!disposed) {
      setTimeout(() => connect(url), 2000);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function initWebSocket(url: string, onMessage: (msg: WsMessage) => void) {
  disposed = false;
  messageHandler = onMessage;
  connect(url);

  return () => {
    disposed = true;
    ws?.close();
    ws = null;
    messageHandler = null;
  };
}

export function getWebSocketStore() {
  return {
    get connected() { return connected; },
  };
}
