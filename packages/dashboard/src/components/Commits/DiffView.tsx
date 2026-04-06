'use client';

import { useEffect, useRef } from 'react';
import type { CommitDiff, FunctionInfo, DiffLine } from '@agent-monitor/types';

interface DiffViewProps {
  diff: CommitDiff | null;
  activeFunctionId: string | null;
  functions: FunctionInfo[];
  isLoading: boolean;
}

const lineStyles: Record<DiffLine['type'], { bg: string; text: string; prefix: string }> = {
  added: { bg: 'bg-[oklch(0.78_0.14_190/0.06)]', text: 'text-signal', prefix: '+' },
  removed: { bg: 'bg-[oklch(0.78_0.12_60/0.06)]', text: 'text-warm-dim', prefix: '-' },
  context: { bg: '', text: 'text-text-dim', prefix: ' ' },
  header: { bg: 'bg-surface/50', text: 'text-text-dim/50', prefix: ' ' },
};

export function DiffView({ diff, activeFunctionId, functions, isLoading }: DiffViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeFunctionId && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeFunctionId, diff]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-text-dim">Loading diff...</span>
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-[12px] text-text-dim">Select a commit to view changes</span>
      </div>
    );
  }

  const activeFunction = activeFunctionId
    ? functions.find((f) => f.id === activeFunctionId) ?? null
    : null;

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      {diff.diffs.map((fileDiff) => {
        const isTargetFile = activeFunction && fileDiff.filePath.endsWith(activeFunction.filePath);

        return (
          <div key={fileDiff.filePath}>
            <div className="text-[11px] font-mono text-text-secondary bg-surface-raised/30 px-3 py-1.5 sticky top-0 z-10">
              {fileDiff.filePath}
            </div>
            <pre className="text-[11px] font-mono leading-[1.6]">
              <code>
                {fileDiff.lines.map((line, i) => {
                  const style = lineStyles[line.type];
                  const isTargetLine =
                    isTargetFile &&
                    activeFunction &&
                    line.newLineNo !== null &&
                    line.newLineNo >= activeFunction.line &&
                    line.newLineNo < activeFunction.line + 10;

                  return (
                    <div
                      key={i}
                      ref={isTargetLine && !targetRef.current ? targetRef : undefined}
                      className={`flex ${style.bg} ${isTargetLine ? 'ring-1 ring-signal/30' : ''}`}
                    >
                      <span className="w-6 text-right font-mono text-[10px] text-text-dim tabular-nums select-none shrink-0 px-1">
                        {line.oldLineNo ?? ''}
                      </span>
                      <span className="w-6 text-right font-mono text-[10px] text-text-dim tabular-nums select-none shrink-0 px-1">
                        {line.newLineNo ?? ''}
                      </span>
                      <span className={`flex-1 px-2 ${style.text} ${line.type === 'header' ? 'text-[10px]' : ''}`}>
                        {style.prefix}{line.content}
                      </span>
                    </div>
                  );
                })}
              </code>
            </pre>
          </div>
        );
      })}
    </div>
  );
}
