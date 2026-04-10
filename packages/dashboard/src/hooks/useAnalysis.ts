'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AnalysisResult, AnalysisStatus, WsMessage } from '@agent-monitor/types';
import { fetchAnalysisResults, triggerAnalysisRequest, stopAnalysisRequest } from '@/lib/api';

export function useAnalysis() {
  const [analyses, setAnalyses] = useState<Map<string, AnalysisResult>>(new Map());
  const [activeRuns, setActiveRuns] = useState<Map<string, AnalysisStatus>>(new Map());

  useEffect(() => {
    fetchAnalysisResults()
      .then((results) => {
        const map = new Map<string, AnalysisResult>();
        for (const r of results) map.set(r.id, r);
        setAnalyses(map);
      })
      .catch(() => {});
  }, []);

  const handleAnalysisMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'analysis-started':
      case 'analysis-progress':
        setActiveRuns((prev) => new Map(prev).set(msg.payload.runId, msg.payload));
        break;
      case 'analysis-completed':
        setActiveRuns((prev) => {
          const next = new Map(prev);
          next.delete(msg.payload.runId);
          return next;
        });
        setAnalyses((prev) => {
          const next = new Map(prev);
          for (const r of msg.payload.results) next.set(r.id, r);
          return next;
        });
        break;
      case 'analysis-failed':
        setActiveRuns((prev) => {
          const next = new Map(prev);
          next.delete(msg.payload.runId);
          return next;
        });
        break;
    }
  }, []);

  const triggerAnalysis = useCallback(
    (functionIds: string[], taskName?: string) => triggerAnalysisRequest(functionIds, taskName),
    [],
  );

  const stopAnalysis = useCallback(
    (runId: string) => stopAnalysisRequest(runId),
    [],
  );

  const getAnalysesForFunction = useCallback(
    (functionId: string): AnalysisResult[] => {
      return Array.from(analyses.values()).filter((a) => a.functionId === functionId);
    },
    [analyses],
  );

  return {
    analyses: Array.from(analyses.values()),
    activeRuns: Array.from(activeRuns.values()),
    handleAnalysisMessage,
    triggerAnalysis,
    stopAnalysis,
    getAnalysesForFunction,
  };
}
