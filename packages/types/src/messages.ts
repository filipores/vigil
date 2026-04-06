import type { FunctionInfo } from './function.js';
import type { FileChange } from './file.js';

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
  };
}

export type WsMessage =
  | WsFunctionDiscovered
  | WsFunctionUpdated
  | WsFunctionRemoved
  | WsFileChanged
  | WsStateSnapshot;
