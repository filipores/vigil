import type { FunctionInfo } from './function.js';
import type { FileChange } from './file.js';
import type { DataFlowEdge } from './dataflow.js';
import type { AnalysisStatus, AnalysisResult } from './analysis.js';

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
    analyses?: AnalysisResult[];
  };
}

export interface WsEdgesUpdated {
  type: 'edges-updated';
  payload: {
    filePath: string;
    edges: DataFlowEdge[];
  };
}

export interface WsAnalysisStarted {
  type: 'analysis-started';
  payload: AnalysisStatus;
}

export interface WsAnalysisProgress {
  type: 'analysis-progress';
  payload: AnalysisStatus;
}

export interface WsAnalysisCompleted {
  type: 'analysis-completed';
  payload: { runId: string; results: AnalysisResult[] };
}

export interface WsAnalysisFailed {
  type: 'analysis-failed';
  payload: { runId: string; error: string };
}

export type WsMessage =
  | WsFunctionDiscovered
  | WsFunctionUpdated
  | WsFunctionRemoved
  | WsFileChanged
  | WsStateSnapshot
  | WsEdgesUpdated
  | WsAnalysisStarted
  | WsAnalysisProgress
  | WsAnalysisCompleted
  | WsAnalysisFailed;
