'use client';

import type { FunctionInfo, AgentContext } from '@agent-monitor/types';
import { CodePreview } from './CodePreview';

interface DetailPanelProps {
  fn: FunctionInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onAskAgent: (ctx: AgentContext) => void;
  onOpenEditor: () => void;
}

export function DetailPanel({ fn, isOpen, onClose, onAskAgent, onOpenEditor }: DetailPanelProps) {
  const handleAskAgent = () => {
    if (!fn) return;
    onAskAgent({
      snippet: fn.sourcePreview,
      file: fn.filePath,
      lineStart: fn.line,
      lineEnd: fn.line + fn.sourcePreview.split('\n').length - 1,
    });
  };

  return (
    <div
      className="w-80 border-l border-border bg-background overflow-y-auto transition-all duration-200 ease-in-out"
      style={{
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        position: isOpen ? 'relative' : 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {fn && (
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">{fn.name}</h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-all duration-200 ease-in-out"
            >
              ✕
            </button>
          </div>

          <button
            onClick={onOpenEditor}
            className="text-xs text-text-muted hover:text-accent transition-all duration-200 ease-in-out"
          >
            {fn.filePath}:{fn.line}
          </button>

          {fn.params.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Parameters
              </h3>
              <div className="rounded-lg overflow-hidden border border-border">
                {fn.params.map((p, i) => (
                  <div
                    key={p.name}
                    className={`flex justify-between px-3 py-1.5 text-sm ${
                      i % 2 === 0 ? 'bg-surface' : 'bg-background'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-text-muted">{p.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Returns
            </span>
            <span className="ml-2 text-sm bg-surface-raised rounded px-2 py-0.5">
              {fn.returnType}
            </span>
          </div>

          {fn.jsdoc && (
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Documentation
              </h3>
              <p className="text-sm italic text-text-muted">{fn.jsdoc}</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Preview
            </h3>
            <CodePreview code={fn.sourcePreview} startLine={fn.line} />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onOpenEditor}
              className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface transition-all duration-200 ease-in-out"
            >
              Open in Editor
            </button>
            <button
              onClick={handleAskAgent}
              className="flex-1 px-4 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 transition-all duration-200 ease-in-out"
            >
              Ask Agent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
