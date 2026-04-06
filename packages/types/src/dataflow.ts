export type EdgeType = 'call' | 'data' | 'import';

export interface DataFlowEdge {
  sourceId: string;
  targetId: string;
  label: string;
  edgeType: EdgeType;
  filePath?: string;
}
