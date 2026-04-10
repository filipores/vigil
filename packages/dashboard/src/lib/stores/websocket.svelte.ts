import type { WsMessage } from '@agent-monitor/types';

let connected = $state(false);
let ws: WebSocket | null = null;
let messageHandler: ((msg: WsMessage) => void) | null = null;

function connect(url: string) {
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
    setTimeout(() => connect(url), 2000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function initWebSocket(url: string, onMessage: (msg: WsMessage) => void) {
  messageHandler = onMessage;
  connect(url);

  return () => {
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
