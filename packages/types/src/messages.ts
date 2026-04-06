import type { FunctionInfo } from './function.js';
import type { FileChange } from './file.js';
import type { DataFlowEdge } from './dataflow.js';

export interface WsFunctionDiscovered {
  type: 'function-discovered';
  payload: FunctionInfo;
}

export interface WsFunctionUpdated {
  type: 'function-updated';
  payload: FunctionInfo;
}

export interface WsFunctionRemoved {
  type: 'function-removed';
  payload: { id: string };
}

export interface WsFileChanged {
  type: 'file-changed';
  payload: FileChange;
}

export interface WsStateSnapshot {
  type: 'state-snapshot';
  payload: {
    functions: FunctionInfo[];
    files: FileChange[];
    edges: DataFlowEdge[];
  };
}

export interface WsEdgesUpdated {
  type: 'edges-updated';
  payload: {
    filePath: string;
    edges: DataFlowEdge[];
  };
}

export type WsMessage =
  | WsFunctionDiscovered
  | WsFunctionUpdated
  | WsFunctionRemoved
  | WsFileChanged
  | WsStateSnapshot
  | WsEdgesUpdated;
