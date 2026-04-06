import type { FunctionInfo, FileChange, DataFlowEdge } from '@agent-monitor/types';

const functions = new Map<string, FunctionInfo>();
const files = new Map<string, FileChange>();
const fileEdges = new Map<string, DataFlowEdge[]>();

export function getAllFunctions(): FunctionInfo[] { return [...functions.values()]; }
export function getFunction(id: string): FunctionInfo | undefined { return functions.get(id); }
export function upsertFunction(fn: FunctionInfo): void { functions.set(fn.id, fn); }
export function removeFunction(id: string): void { functions.delete(id); }
export function getAllFiles(): FileChange[] { return [...files.values()]; }
export function upsertFile(fc: FileChange): void { files.set(fc.filePath, fc); }

export function upsertFileEdges(filePath: string, edges: DataFlowEdge[]): void {
  fileEdges.set(filePath, edges);
}
export function removeFileEdges(filePath: string): void {
  fileEdges.delete(filePath);
}
export function getAllEdges(): DataFlowEdge[] {
  const result: DataFlowEdge[] = [];
  for (const edges of fileEdges.values()) result.push(...edges);
  return result;
}

export function clearStore(): void { functions.clear(); files.clear(); fileEdges.clear(); }
