'use client';

import type { AnalysisResult, AnalysisStatus } from '@agent-monitor/types';

interface AnalysisSectionProps {
  analysisResults: AnalysisResult[];
  activeRun: AnalysisStatus | undefined;
  onTrigger: () => void;
  onStop: (runId: string) => void;
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'text-text-secondary',
  warning: 'text-warm',
  critical: 'text-red-400',
};

const SEVERITY_DOT: Record<string, string> = {
  info: 'bg-text-secondary',
  warning: 'bg-warm',
  critical: 'bg-red-400',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AnalysisSection({ analysisResults, activeRun, onTrigger, onStop }: AnalysisSectionProps) {
  const sorted = [...analysisResults].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
          Integration Analysis
        </div>
        {activeRun ? (
          <button
            onClick={() => onStop(activeRun.runId)}
            className="px-2 py-1 text-[10px] font-medium text-warm border border-warm/30 rounded hover:bg-warm/10 transition-colors duration-150"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onTrigger}
            className="px-2 py-1 text-[10px] font-medium text-void bg-signal rounded hover:brightness-110 transition-all duration-150"
          >
            Run Analysis
          </button>
        )}
      </div>

      {/* Active run status */}
      {activeRun && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-md border border-signal/20 bg-signal/5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          <span className="text-[11px] text-signal">
            {activeRun.status === 'queued' ? 'Queued' : 'Running'}
            {activeRun.progress && <span className="text-text-dim ml-1">— {activeRun.progress}</span>}
          </span>
        </div>
      )}

      {/* Results */}
      {sorted.length === 0 && !activeRun && (
        <p className="text-[11px] text-text-dim italic">No analysis results yet.</p>
      )}

      {sorted.map((result, idx) => (
        <div
          key={result.id}
          className={`${idx > 0 ? 'mt-3 pt-3 border-t border-border-subtle' : ''}`}
        >
          {/* Timestamp + task */}
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[10px] text-text-dim tabular-nums">{formatTimestamp(result.timestamp)}</span>
            <span className="text-[10px] text-text-secondary">{result.taskName}</span>
          </div>

          {/* Summary */}
          <p className="text-[12px] leading-relaxed text-text-secondary mb-2">
            {result.summary}
          </p>

          {/* Concerns */}
          {result.concerns.length > 0 && (
            <div className="space-y-1 mb-2">
              {result.concerns.map((c, ci) => (
                <div key={ci} className="flex items-start gap-1.5">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[c.severity] ?? SEVERITY_DOT.info}`} />
                  <span className={`text-[11px] leading-snug ${SEVERITY_CLASS[c.severity] ?? SEVERITY_CLASS.info}`}>
                    {c.description}
                    {c.line != null && (
                      <span className="text-text-dim ml-1 text-[10px]">L{c.line}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Integration notes */}
          {result.integrationNotes.length > 0 && (
            <div className="space-y-0.5">
              {result.integrationNotes.map((note, ni) => (
                <p key={ni} className="text-[11px] text-text-dim leading-snug pl-2 border-l border-border-subtle">
                  {note}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
