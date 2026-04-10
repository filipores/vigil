'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FunctionInfo, FileChange, DataFlowEdge, WsMessage } from '@agent-monitor/types';
import { fetchFunctions, fetchFiles, fetchEdges } from '@/lib/api';

export function useFunctions() {
  const [functionsMap, setFunctionsMap] = useState<Map<string, FunctionInfo>>(new Map());
  const [files, setFiles] = useState<FileChange[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edges, setEdges] = useState<DataFlowEdge[]>([]);

  useEffect(() => {
    fetchFunctions()
      .then((fns) => {
        const map = new Map<string, FunctionInfo>();
        for (const fn of fns) map.set(fn.id, fn);
        setFunctionsMap(map);
      })
      .catch(() => {});

    fetchFiles()
      .then(setFiles)
      .catch(() => {});

    fetchEdges()
      .then(setEdges)
      .catch(() => {});
  }, []);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'function-discovered':
      case 'function-updated':
        setFunctionsMap((prev) => new Map(prev).set(msg.payload.id, msg.payload));
        break;
      case 'function-removed':
        setFunctionsMap((prev) => {
          const next = new Map(prev);
          next.delete(msg.payload.id);
          return next;
        });
        break;
      case 'file-changed':
        setFiles((prev) => {
          const idx = prev.findIndex((f) => f.filePath === msg.payload.filePath);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = msg.payload;
            return next;
          }
          return [...prev, msg.payload];
        });
        break;
      case 'edges-updated':
        setEdges((prev) => [
          ...prev.filter((e) => e.filePath !== msg.payload.filePath),
          ...msg.payload.edges,
        ]);
        break;
      case 'state-snapshot':
        setFunctionsMap(() => {
          const map = new Map<string, FunctionInfo>();
          for (const fn of msg.payload.functions) map.set(fn.id, fn);
          return map;
        });
        setFiles(msg.payload.files);
        setEdges(msg.payload.edges ?? []);
        break;
    }
  }, []);

  const functions = useMemo(() => Array.from(functionsMap.values()), [functionsMap]);

  const selectFunction = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  return { functions, files, edges, selectedId, selectFunction, handleMessage };
}
