import type { AnalysisResult, AnalysisStatus, WsMessage } from '@agent-monitor/types';
import { fetchAnalysisResults, triggerAnalysisRequest, stopAnalysisRequest } from '$lib/api';

let analyses = $state<Map<string, AnalysisResult>>(new Map());
let activeRuns = $state<Map<string, AnalysisStatus>>(new Map());
let streamingOutput = $state<Map<string, string>>(new Map());

let initialized = false;

export function initAnalysis() {
  if (initialized) return;
  initialized = true;

  fetchAnalysisResults()
    .then((results) => {
      const map = new Map<string, AnalysisResult>();
      for (const r of results) map.set(r.id, r);
      analyses = map;
    })
    .catch((err) => console.warn('vigil: fetch failed:', err.message));
}

export function handleAnalysisMessage(msg: WsMessage) {
  switch (msg.type) {
    case 'analysis-started':
    case 'analysis-progress': {
      const incoming = msg.payload;
      const existing = activeRuns.get(incoming.runId);
      activeRuns = new Map(activeRuns).set(incoming.runId, {
        ...existing,
        ...incoming,
        functionIds: incoming.functionIds ?? existing?.functionIds,
      });
      if (msg.type === 'analysis-progress' && incoming.progress) {
        const prev = streamingOutput.get(incoming.runId) ?? '';
        streamingOutput = new Map(streamingOutput).set(incoming.runId, prev + incoming.progress);
      }
      break;
    }
    case 'analysis-completed': {
      const next = new Map(activeRuns);
      next.delete(msg.payload.runId);
      activeRuns = next;
      const nextAnalyses = new Map(analyses);
      for (const r of msg.payload.results) nextAnalyses.set(r.id, r);
      analyses = nextAnalyses;
      const nextStream = new Map(streamingOutput);
      nextStream.delete(msg.payload.runId);
      streamingOutput = nextStream;
      break;
    }
    case 'analysis-failed': {
      const next = new Map(activeRuns);
      next.delete(msg.payload.runId);
      activeRuns = next;
      const nextStreamFail = new Map(streamingOutput);
      nextStreamFail.delete(msg.payload.runId);
      streamingOutput = nextStreamFail;
      break;
    }
  }
}

export function triggerAnalysis(functionIds: string[], taskName?: string) {
  for (const [, run] of activeRuns) {
    if (run.status !== 'running' && run.status !== 'queued') continue;
    if (run.functionIds && functionIds.some((id) => run.functionIds!.includes(id))) {
      return Promise.resolve({ runId: run.runId, status: run.status });
    }
  }
  return triggerAnalysisRequest(functionIds, taskName);
}

export function stopAnalysis(runId: string) {
  return stopAnalysisRequest(runId);
}

export function getAnalysesForFunction(functionId: string): AnalysisResult[] {
  return Array.from(analyses.values()).filter((a) => a.functionId === functionId);
}

export function getStreamingOutput(runId: string): string {
  return streamingOutput.get(runId) ?? '';
}

export function hydrateFromSnapshot(results: AnalysisResult[]) {
  const map = new Map<string, AnalysisResult>();
  for (const r of results) map.set(r.id, r);
  analyses = map;
}

export function getAnalysisStore() {
  return {
    get analyses() { return Array.from(analyses.values()); },
    get activeRuns() { return Array.from(activeRuns.values()); },
    get streamingOutput() { return streamingOutput; },
    handleAnalysisMessage,
    triggerAnalysis,
    stopAnalysis,
    getAnalysesForFunction,
    getStreamingOutput,
  };
}
