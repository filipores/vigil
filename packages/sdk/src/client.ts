import WebSocket from 'ws';
import type { WsMessage } from '@agent-monitor/types';

export class WsClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private closed = false;
  private serverUrl: string;

  constructor(serverUrl = 'ws://localhost:3001/ws') {
    this.serverUrl = serverUrl;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;

    this.ws = new WebSocket(this.serverUrl);

    this.ws.on('open', () => {
      this.reconnectDelay = 1000;
      this.ws!.send(JSON.stringify({ type: 'sdk-hello' }));
      // Drain queued messages
      for (const msg of this.queue) {
        this.ws!.send(msg);
      }
      this.queue = [];
    });

    this.ws.on('close', () => {
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      // Error will be followed by close event
    });
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  send(msg: WsMessage): void {
    const data = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.queue.push(data);
    }
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.queue = [];
  }
}
