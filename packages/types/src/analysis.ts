export interface AnalysisConcern {
  severity: 'info' | 'warning' | 'critical';
  description: string;
  line?: number;
}

export interface AnalysisResult {
  id: string;
  functionId: string;
  taskName: string;
  summary: string;
  details: string;
  concerns: AnalysisConcern[];
  integrationNotes: string[];
  timestamp: number;
}

export interface AnalysisTriggerRequest {
  functionIds: string[];
  taskName?: string;
}

export interface AnalysisStatus {
  runId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: string;
}
