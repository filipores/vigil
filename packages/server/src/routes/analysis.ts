import { Hono } from 'hono';
import type { AnalysisTriggerRequest } from '@agent-monitor/types';
import { getAnalysis, getAnalysesByFunction, getAllAnalyses } from '../analysis/store.js';
import { getAnalysisEngine } from '../analysis/engineInstance.js';

export const analysisRouter = new Hono();

analysisRouter.post('/api/analysis/trigger', async (c) => {
  const body = await c.req.json<AnalysisTriggerRequest>();
  const engine = getAnalysisEngine();
  if (!engine) {
    return c.json({ error: 'Analysis engine not initialized' }, 503);
  }

  try {
    const runId = await engine.triggerAnalysis(body.functionIds, body.taskName);
    return c.json({ runId, status: 'running' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

analysisRouter.get('/api/analysis/results', (c) => {
  const functionId = c.req.query('functionId');
  if (functionId) {
    return c.json(getAnalysesByFunction(functionId));
  }
  return c.json(getAllAnalyses());
});

analysisRouter.get('/api/analysis/results/:id', (c) => {
  const result = getAnalysis(c.req.param('id'));
  if (!result) return c.json({ error: 'Analysis not found' }, 404);
  return c.json(result);
});

analysisRouter.post('/api/analysis/stop/:runId', (c) => {
  const engine = getAnalysisEngine();
  if (!engine) {
    return c.json({ error: 'Analysis engine not initialized' }, 503);
  }

  const stopped = engine.stopAnalysis(c.req.param('runId'));
  if (!stopped) return c.json({ error: 'No running analysis with that ID' }, 404);
  return c.json({ status: 'stopped' });
});

analysisRouter.get('/api/analysis/status', (c) => {
  const engine = getAnalysisEngine();
  if (!engine) {
    return c.json({ error: 'Analysis engine not initialized' }, 503);
  }
  return c.json(engine.getStatus());
});
