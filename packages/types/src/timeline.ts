export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'function-added' | 'function-updated' | 'function-removed' | 'analysis-completed' | 'rule-violation' | 'commit';
  summary: string;
  functionId?: string;
  filePath?: string;
  commitHash?: string;
  commitMessage?: string;
  analysisId?: string;
  severity?: 'info' | 'warning' | 'critical';
}
