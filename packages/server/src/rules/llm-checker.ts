import type { RuleDefinition } from '@agent-monitor/types';

export function buildRulesPrompt(rules: RuleDefinition[]): string {
  const llmRules = rules.filter((r) => r.enabled && !r.structural);
  if (llmRules.length === 0) return '';

  const ruleLines = llmRules.map((r, i) => {
    return `${i + 1}. [${r.severity}] ${r.rule}`;
  }).join('\n');

  return `
## Architecture Rules

Check the following rules against the target functions. For each rule, report whether it passes or fails.

${ruleLines}

Output a "ruleViolations" array in your JSON response with { ruleId, pass: boolean, violation?: string } for each rule.`;
}

export function getLLMRules(rules: RuleDefinition[]): RuleDefinition[] {
  return rules.filter((r) => r.enabled && !r.structural);
}
