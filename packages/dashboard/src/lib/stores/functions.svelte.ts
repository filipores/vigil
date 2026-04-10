import type { FunctionInfo, FileChange, DataFlowEdge, WsMessage } from '@agent-monitor/types';
import { fetchFunctions, fetchFiles, fetchEdges } from '$lib/api';

let functionsMap = $state<Map<string, FunctionInfo>>(new Map());
let files = $state<FileChange[]>([]);
let edges = $state<DataFlowEdge[]>([]);
let selectedId = $state<string | null>(null);

let initialized = false;

export function initFunctions() {
  if (initialized) return;
  initialized = true;

  fetchFunctions()
    .then((fns) => {
      const map = new Map<string, FunctionInfo>();
      for (const fn of fns) map.set(fn.id, fn);
      functionsMap = map;
    })
    .catch(() => {});

  fetchFiles()
    .then((f) => { files = f; })
    .catch(() => {});

  fetchEdges()
    .then((e) => { edges = e; })
    .catch(() => {});
}

export function handleFunctionsMessage(msg: WsMessage) {
  switch (msg.type) {
    case 'function-discovered':
    case 'function-updated':
      functionsMap = new Map(functionsMap).set(msg.payload.id, msg.payload);
      break;
    case 'function-removed': {
      const next = new Map(functionsMap);
      next.delete(msg.payload.id);
      functionsMap = next;
      break;
    }
    case 'file-changed': {
      const idx = files.findIndex((f) => f.filePath === msg.payload.filePath);
      if (idx >= 0) {
        const next = [...files];
        next[idx] = msg.payload;
        files = next;
      } else {
        files = [...files, msg.payload];
      }
      break;
    }
    case 'edges-updated':
      edges = [
        ...edges.filter((e) => e.filePath !== msg.payload.filePath),
        ...msg.payload.edges,
      ];
      break;
    case 'state-snapshot': {
      const map = new Map<string, FunctionInfo>();
      for (const fn of msg.payload.functions) map.set(fn.id, fn);
      functionsMap = map;
      files = msg.payload.files;
      edges = msg.payload.edges ?? [];
      break;
    }
  }
}

export function selectFunction(id: string | null) {
  selectedId = id;
}

export function getFunctionsStore() {
  return {
    get functions() { return Array.from(functionsMap.values()); },
    get files() { return files; },
    get edges() { return edges; },
    get selectedId() { return selectedId; },
    selectFunction,
    handleMessage: handleFunctionsMessage,
  };
}
