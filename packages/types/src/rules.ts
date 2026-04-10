export interface RuleDefinition {
  id: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  structural?: {
    from?: { category?: string; pathContains?: string };
    to?: { category?: string; pathContains?: string };
    edge?: 'call' | 'import' | 'data';
    action: 'deny';
  };
}

export interface RuleViolation {
  ruleId: string;
  rule: string;
  functionId: string;
  filePath: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  edgeDetail?: { from: string; to: string; edgeType: string };
}
