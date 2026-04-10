import { readFileSync, watchFile, unwatchFile, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RuleDefinition } from '@agent-monitor/types';

let currentRules: RuleDefinition[] = [];
let rulesFilePath = '';

export function initRulesLoader(dir?: string): void {
  const base = dir ?? process.cwd();
  rulesFilePath = join(base, '.vigil', 'rules.json');
  reload();

  if (existsSync(rulesFilePath)) {
    watchFile(rulesFilePath, { interval: 1000 }, () => {
      console.log('[rules] rules.json changed, reloading...');
      reload();
    });
  }
}

export function loadRules(): RuleDefinition[] {
  reload();
  return currentRules;
}

export function getRules(): RuleDefinition[] {
  return currentRules;
}

function reload(): void {
  if (!rulesFilePath || !existsSync(rulesFilePath)) {
    currentRules = [];
    return;
  }

  try {
    const raw = readFileSync(rulesFilePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      console.warn('[rules] rules.json is not an array, ignoring');
      currentRules = [];
      return;
    }

    const valid: RuleDefinition[] = [];
    for (const item of parsed) {
      if (typeof item.id !== 'string' || typeof item.rule !== 'string') {
        console.warn(`[rules] skipping malformed rule: ${JSON.stringify(item).slice(0, 100)}`);
        continue;
      }
      if (!['info', 'warning', 'critical'].includes(item.severity)) {
        console.warn(`[rules] skipping rule "${item.id}" with invalid severity: ${item.severity}`);
        continue;
      }
      valid.push({
        id: item.id,
        rule: item.rule,
        severity: item.severity,
        enabled: item.enabled !== false,
        structural: item.structural,
      });
    }

    currentRules = valid;
    console.log(`[rules] loaded ${valid.length} rule(s)`);
  } catch (err) {
    console.warn(`[rules] failed to load rules.json: ${err instanceof Error ? err.message : err}`);
    currentRules = [];
  }
}
