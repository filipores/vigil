import type { RuleDefinition, RuleViolation, FunctionInfo, DataFlowEdge } from '@agent-monitor/types';

export function checkStructuralRules(
  rules: RuleDefinition[],
  functions: FunctionInfo[],
  edges: DataFlowEdge[],
): RuleViolation[] {
  const structuralRules = rules.filter((r) => r.enabled && r.structural);
  if (structuralRules.length === 0) return [];

  const fnById = new Map(functions.map((f) => [f.id, f]));
  const violations: RuleViolation[] = [];

  for (const rule of structuralRules) {
    const s = rule.structural!;

    for (const edge of edges) {
      // Check edge type filter
      if (s.edge && edge.edgeType !== s.edge) continue;

      const sourceFn = fnById.get(edge.sourceId);
      const targetFn = fnById.get(edge.targetId);
      if (!sourceFn || !targetFn) continue;

      // Check "from" constraints
      if (s.from) {
        if (s.from.category && sourceFn.category !== s.from.category) continue;
        if (s.from.pathContains && !sourceFn.filePath.includes(s.from.pathContains)) continue;
      }

      // Check "to" constraints
      if (s.to) {
        if (s.to.category && targetFn.category !== s.to.category) continue;
        if (s.to.pathContains && !targetFn.filePath.includes(s.to.pathContains)) continue;
      }

      // If we reach here on a "deny" rule, it's a violation
      if (s.action === 'deny') {
        violations.push({
          ruleId: rule.id,
          rule: rule.rule,
          functionId: sourceFn.id,
          filePath: sourceFn.filePath,
          severity: rule.severity,
          description: `Violation: ${sourceFn.name} (${sourceFn.filePath}) has a ${edge.edgeType} edge to ${targetFn.name} (${targetFn.filePath})`,
          edgeDetail: {
            from: sourceFn.id,
            to: targetFn.id,
            edgeType: edge.edgeType,
          },
        });
      }
    }
  }

  return violations;
}
