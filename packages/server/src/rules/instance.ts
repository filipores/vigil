import type { createRulesEngine } from './engine.js';

type RulesEngine = ReturnType<typeof createRulesEngine>;

let engine: RulesEngine | null = null;

export function setRulesEngine(e: RulesEngine): void {
  engine = e;
}

export function getRulesEngine(): RulesEngine | null {
  return engine;
}
