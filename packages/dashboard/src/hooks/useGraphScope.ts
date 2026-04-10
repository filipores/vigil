'use client';

import { useState, useMemo, useCallback } from 'react';
import type { FunctionInfo, DataFlowEdge } from '@agent-monitor/types';

export type ScopeMode =
  | { type: 'all' }
  | { type: 'focus'; functionId: string; hops: number }
  | { type: 'commit'; functionIds: Set<string> }
  | { type: 'category'; categories: Set<string> };

interface UseGraphScopeOpts {
  functions: FunctionInfo[];
  edges: DataFlowEdge[];
}

function computeFocusScope(
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
  functionId: string,
  hops: number,
): { scopedFunctions: FunctionInfo[]; scopedEdges: DataFlowEdge[] } {
  // Build adjacency lists (both directions)
  const neighbors = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbors.has(e.sourceId)) neighbors.set(e.sourceId, new Set());
    if (!neighbors.has(e.targetId)) neighbors.set(e.targetId, new Set());
    neighbors.get(e.sourceId)!.add(e.targetId);
    neighbors.get(e.targetId)!.add(e.sourceId);
  }

  // BFS from functionId up to N hops
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
  // Include changed functions + their direct callers/callees (1-hop)
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

export function useGraphScope({ functions, edges }: UseGraphScopeOpts) {
  const [mode, setMode] = useState<ScopeMode>({ type: 'all' });

  const { scopedFunctions, scopedEdges } = useMemo(() => {
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
  }, [functions, edges, mode]);

  const setFocusMode = useCallback(
    (functionId: string, hops?: number) =>
      setMode({ type: 'focus', functionId, hops: hops ?? 2 }),
    [],
  );

  const setCommitMode = useCallback(
    (functionIds: Set<string>) => setMode({ type: 'commit', functionIds }),
    [],
  );

  const setCategoryMode = useCallback(
    (categories: Set<string>) => setMode({ type: 'category', categories }),
    [],
  );

  const clearScope = useCallback(() => setMode({ type: 'all' }), []);

  return {
    scopedFunctions,
    scopedEdges,
    scopeMode: mode,
    setFocusMode,
    setCommitMode,
    setCategoryMode,
    clearScope,
    isScoped: mode.type !== 'all',
  };
}
