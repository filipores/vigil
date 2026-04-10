import { Hono } from 'hono';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { RuleDefinition } from '@agent-monitor/types';
import { getRules, loadRules } from '../rules/loader.js';
import { getRulesEngine } from '../rules/instance.js';
import { getAllFunctions, getAllEdges } from '../store.js';
import { checkStructuralRules } from '../rules/checker.js';

export const rulesRouter = new Hono();

rulesRouter.get('/api/rules', (c) => {
  return c.json(getRules());
});

rulesRouter.put('/api/rules', async (c) => {
  const body = await c.req.json<RuleDefinition[]>();

  if (!Array.isArray(body)) {
    return c.json({ error: 'Request body must be an array of rules' }, 400);
  }

  const filePath = join(process.cwd(), '.vigil', 'rules.json');
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(body, null, 2) + '\n', 'utf-8');

  // Reload the rules from disk
  const rules = loadRules();
  return c.json(rules);
});

rulesRouter.get('/api/rules/violations', (c) => {
  const engine = getRulesEngine();
  if (!engine) {
    return c.json({ error: 'Rules engine not initialized' }, 503);
  }
  return c.json(engine.getViolations());
});

rulesRouter.post('/api/rules/check', (c) => {
  const rules = getRules();
  const functions = getAllFunctions();
  const edges = getAllEdges();

  const violations = checkStructuralRules(rules, functions, edges);

  // Also broadcast if engine is available
  const engine = getRulesEngine();
  if (engine && violations.length > 0) {
    // The engine manages its own state; for a manual check we just return results
  }

  return c.json({ violations });
});
