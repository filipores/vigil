import type { FunctionInfo, DataFlowEdge } from '@agent-monitor/types';

export type ScopeMode =
  | { type: 'all' }
  | { type: 'focus'; functionId: string; hops: number }
  | { type: 'commit'; functionIds: Set<string> }
  | { type: 'category'; categories: Set<string> };

let mode = $state<ScopeMode>({ type: 'all' });

function computeFocusScope(
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
  functionId: string,
  hops: number,
): { scopedFunctions: FunctionInfo[]; scopedEdges: DataFlowEdge[] } {
  const neighbors = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbors.has(e.sourceId)) neighbors.set(e.sourceId, new Set());
    if (!neighbors.has(e.targetId)) neighbors.set(e.targetId, new Set());
    neighbors.get(e.sourceId)!.add(e.targetId);
    neighbors.get(e.targetId)!.add(e.sourceId);
  }

  const visited = new Set<string>();
  let frontier = [functionId];
  visited.add(functionId);

  for (let hop = 0; hop < hops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      const adj = neighbors.get(id);
      if (!adj) continue;
      for (const neighbor of adj) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  const scopedFunctions = functions.filter((f) => visited.has(f.id));
  const scopedEdges = edges.filter(
    (e) => visited.has(e.sourceId) && visited.has(e.targetId),
  );
  return { scopedFunctions, scopedEdges };
}

function computeCommitScope(
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
  functionIds: Set<string>,
): { scopedFunctions: FunctionInfo[]; scopedEdges: DataFlowEdge[] } {
  const expanded = new Set(functionIds);
  for (const e of edges) {
    if (functionIds.has(e.sourceId)) expanded.add(e.targetId);
    if (functionIds.has(e.targetId)) expanded.add(e.sourceId);
  }

  const scopedFunctions = functions.filter((f) => expanded.has(f.id));
  const scopedEdges = edges.filter(
    (e) => expanded.has(e.sourceId) && expanded.has(e.targetId),
  );
  return { scopedFunctions, scopedEdges };
}

function computeCategoryScope(
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
  categories: Set<string>,
): { scopedFunctions: FunctionInfo[]; scopedEdges: DataFlowEdge[] } {
  const scopedFunctions = functions.filter((f) => categories.has(f.category));
  const idSet = new Set(scopedFunctions.map((f) => f.id));
  const scopedEdges = edges.filter(
    (e) => idSet.has(e.sourceId) && idSet.has(e.targetId),
  );
  return { scopedFunctions, scopedEdges };
}

export function computeScope(
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
): { scopedFunctions: FunctionInfo[]; scopedEdges: DataFlowEdge[] } {
  switch (mode.type) {
    case 'all':
      return { scopedFunctions: functions, scopedEdges: edges };
    case 'focus':
      return computeFocusScope(functions, edges, mode.functionId, mode.hops);
    case 'commit':
      return computeCommitScope(functions, edges, mode.functionIds);
    case 'category':
      return computeCategoryScope(functions, edges, mode.categories);
  }
}

export function setFocusMode(functionId: string, hops?: number) {
  mode = { type: 'focus', functionId, hops: hops ?? 2 };
}

export function setCommitMode(functionIds: Set<string>) {
  mode = { type: 'commit', functionIds };
}

export function setCategoryMode(categories: Set<string>) {
  mode = { type: 'category', categories };
}

export function clearScope() {
  mode = { type: 'all' };
}

export function getGraphScopeStore() {
  return {
    get scopeMode() { return mode; },
    get isScoped() { return mode.type !== 'all'; },
    computeScope,
    setFocusMode,
    setCommitMode,
    setCategoryMode,
    clearScope,
  };
}
