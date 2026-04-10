import type { WsMessage, RuleViolation, RuleDefinition, DataFlowEdge } from '@agent-monitor/types';
import { getAllFunctions, getAllEdges } from '../store.js';
import { getRules } from './loader.js';
import { checkStructuralRules } from './checker.js';
import { getLLMRules } from './llm-checker.js';

export function createRulesEngine(broadcast: (msg: WsMessage) => void) {
  const violations = new Map<string, RuleViolation[]>();

  return {
    onEdgesUpdated(filePath: string, edges: DataFlowEdge[]): void {
      const rules = getRules();
      const allFunctions = getAllFunctions();
      const allEdges = getAllEdges();

      const found = checkStructuralRules(rules, allFunctions, allEdges);

      // Replace violations keyed by file path
      if (found.length > 0) {
        violations.set(filePath, found);
      } else {
        violations.delete(filePath);
      }

      if (found.length > 0) {
        broadcast({
          type: 'rule-violation',
          payload: { violations: found },
        });
      }
    },

    getLLMRules(): RuleDefinition[] {
      return getLLMRules(getRules());
    },

    getViolations(): RuleViolation[] {
      const all: RuleViolation[] = [];
      for (const v of violations.values()) all.push(...v);
      return all;
    },
  };
}
