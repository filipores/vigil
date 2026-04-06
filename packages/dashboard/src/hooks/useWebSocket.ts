'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WsMessage } from '@agent-monitor/types';

interface UseWebSocketOptions {
  url: string;
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ url, onMessage }: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'dashboard-hello' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => connect(), 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    return ws;
  }, [url]);

  useEffect(() => {
    const ws = connect();
    return () => {
      ws.close();
    };
  }, [connect]);

  return { connected };
}
