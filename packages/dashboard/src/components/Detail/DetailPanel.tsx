'use client';

import { useMemo } from 'react';
import type { FunctionInfo, AgentContext, DataFlowEdge, AnalysisResult, AnalysisStatus } from '@agent-monitor/types';
import { CodePreview } from './CodePreview';
import { AnalysisSection } from '@/components/Analysis/AnalysisSection';

interface DetailPanelProps {
  fn: FunctionInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onAskAgent: (ctx: AgentContext) => void;
  onOpenEditor: () => void;
  edges: DataFlowEdge[];
  allFunctions: FunctionInfo[];
  onSelectFunction: (id: string) => void;
  analysisResults?: AnalysisResult[];
  activeAnalysisRun?: AnalysisStatus;
  onTriggerAnalysis: (functionId: string) => void;
  onStopAnalysis: (runId: string) => void;
  onDebugFunction?: (opts: { filePath: string; line: number; functionName: string }) => void;
  onDebugCallChain?: (chain: Array<{ filePath: string; line: number; name: string }>) => void;
  onFocusFunction?: (functionId: string) => void;
}

export function DetailPanel({ fn, isOpen, onClose, onAskAgent, onOpenEditor, edges, allFunctions, onSelectFunction, analysisResults, activeAnalysisRun, onTriggerAnalysis, onStopAnalysis, onDebugFunction, onDebugCallChain, onFocusFunction }: DetailPanelProps) {
  const handleAskAgent = () => {
    if (!fn) return;
    onAskAgent({
      snippet: fn.sourcePreview,
      file: fn.filePath,
      lineStart: fn.line,
      lineEnd: fn.line + fn.sourcePreview.split('\n').length - 1,
    });
  };

  const callers = useMemo(
    () =>
      fn
        ? edges
            .filter((e) => e.targetId === fn.id)
            .map((e) => allFunctions.find((f) => f.id === e.sourceId))
            .filter((f): f is FunctionInfo => !!f)
        : [],
    [edges, fn, allFunctions],
  );

  const callees = useMemo(
    () =>
      fn
        ? edges
            .filter((e) => e.sourceId === fn.id)
            .map((e) => allFunctions.find((f) => f.id === e.targetId))
            .filter((f): f is FunctionInfo => !!f)
        : [],
    [edges, fn, allFunctions],
  );

  if (!isOpen || !fn) return null;

  const shortPath = fn.filePath.split('/').slice(-3).join('/');

  return (
    <div className="w-80 border-l border-border-subtle bg-surface overflow-y-auto shrink-0 animate-slide-in">
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-text truncate font-mono">
              {fn.name}
            </h2>
            <button
              onClick={onOpenEditor}
              className="mt-1 text-[11px] text-text-dim hover:text-signal font-mono transition-colors duration-150 truncate block max-w-full"
              title={`${fn.filePath}:${fn.line}`}
            >
              {shortPath}:{fn.line}
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors p-1 -mr-1 -mt-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-1.5">
          {onDebugFunction && (
            <button
              onClick={() => onDebugFunction({ filePath: fn.filePath, line: fn.line, functionName: fn.name })}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-void bg-signal rounded hover:brightness-110 transition-all duration-150"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1" />
                <circle cx="5" cy="5" r="1" fill="currentColor" />
              </svg>
              Debug
            </button>
          )}
          {onDebugCallChain && (
            <button
              onClick={() => {
                const chain = [
                  ...callers.map((f) => ({ filePath: f.filePath, line: f.line, name: f.name })),
                  { filePath: fn.filePath, line: fn.line, name: fn.name },
                  ...callees.map((f) => ({ filePath: f.filePath, line: f.line, name: f.name })),
                ];
                onDebugCallChain(chain);
              }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-secondary border border-border-subtle rounded hover:bg-surface-raised/50 hover:text-text transition-colors duration-150"
            >
              Debug Chain
            </button>
          )}
          {onFocusFunction && (
            <button
              onClick={() => onFocusFunction(fn.id)}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-secondary border border-border-subtle rounded hover:bg-surface-raised/50 hover:text-text transition-colors duration-150"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" />
                <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                <path d="M5 0v2M5 8v2M0 5h2M8 5h2" stroke="currentColor" strokeWidth="0.8" />
              </svg>
              Focus
            </button>
          )}
        </div>

        {/* Called by */}
        {callers.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
              Called by
            </div>
            <div className="space-y-0.5">
              {callers.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectFunction(f.id)}
                  className="block text-[11px] font-mono text-text-secondary hover:text-signal transition-colors"
                >
                  {f.name}{' '}
                  <span className="text-text-dim text-[10px]">
                    {f.filePath.split('/').pop()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calls */}
        {callees.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
              Calls
            </div>
            <div className="space-y-0.5">
              {callees.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectFunction(f.id)}
                  className="block text-[11px] font-mono text-text-secondary hover:text-signal transition-colors"
                >
                  {f.name}{' '}
                  <span className="text-text-dim text-[10px]">
                    {f.filePath.split('/').pop()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Params */}
        {fn.params.length > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
              Parameters
            </div>
            <div className="rounded-md overflow-hidden border border-border-subtle">
              {fn.params.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono ${
                    i % 2 === 0 ? 'bg-surface-raised/40' : ''
                  }`}
                >
                  <span className="text-text">{p.name}</span>
                  <span className="text-signal-dim text-[11px]">{p.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Return type */}
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
            Returns
          </span>
          <span className="text-[11px] font-mono text-warm-dim bg-surface-raised/60 rounded px-1.5 py-0.5">
            {fn.returnType}
          </span>
        </div>

        {/* JSDoc */}
        {fn.jsdoc && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
              Documentation
            </div>
            <p className="text-[12px] leading-relaxed text-text-secondary italic">
              {fn.jsdoc}
            </p>
          </div>
        )}

        {/* Source preview */}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Source
          </div>
          <CodePreview code={fn.sourcePreview} startLine={fn.line} />
        </div>

        {/* Analysis */}
        <AnalysisSection
          analysisResults={analysisResults ?? []}
          activeRun={activeAnalysisRun}
          onTrigger={() => onTriggerAnalysis(fn.id)}
          onStop={onStopAnalysis}
        />

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onOpenEditor}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-text-secondary border border-border-subtle rounded-md hover:bg-surface-raised/50 hover:text-text transition-colors duration-150"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 10l2.5-1L9 4.5 7.5 3 3 7.5 2 10z" stroke="currentColor" strokeWidth="1" />
              <path d="M6.5 3.5l2 2" stroke="currentColor" strokeWidth="1" />
            </svg>
            Editor
          </button>
          <button
            onClick={handleAskAgent}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-void bg-signal rounded-md hover:brightness-110 transition-all duration-150"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1" />
              <circle cx="6" cy="6" r="1.5" fill="currentColor" />
            </svg>
            Ask Agent
          </button>
        </div>
      </div>
    </div>
  );
}
