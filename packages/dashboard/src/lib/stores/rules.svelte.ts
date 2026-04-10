import type { RuleDefinition, RuleViolation, WsMessage } from '@agent-monitor/types';
import { fetchRules, fetchViolations, updateRules as updateRulesApi, triggerRulesCheck } from '$lib/api';

let rules = $state<RuleDefinition[]>([]);
let violations = $state<RuleViolation[]>([]);

let initialized = false;

export function initRules() {
  if (initialized) return;
  initialized = true;

  fetchRules()
    .then((r) => { rules = r; })
    .catch((err) => console.warn('vigil: fetch rules failed:', err.message));

  fetchViolations()
    .then((v) => { violations = v; })
    .catch((err) => console.warn('vigil: fetch violations failed:', err.message));
}

export function handleRulesMessage(msg: WsMessage) {
  if (msg.type === 'rule-violation') {
    violations = msg.payload.violations;
  }
}

export async function updateRules(updated: RuleDefinition[]): Promise<void> {
  await updateRulesApi(updated);
  rules = updated;
}

export async function triggerCheck(): Promise<void> {
  await triggerRulesCheck();
}

export function getRulesStore() {
  return {
    get rules() { return rules; },
    get violations() { return violations; },
    get violationsByFunction(): Map<string, RuleViolation[]> {
      const map = new Map<string, RuleViolation[]>();
      for (const v of violations) {
        const existing = map.get(v.functionId);
        if (existing) {
          existing.push(v);
        } else {
          map.set(v.functionId, [v]);
        }
      }
      return map;
    },
    handleRulesMessage,
    fetchRules: async () => {
      rules = await fetchRules();
    },
    updateRules,
    triggerCheck,
  };
}
