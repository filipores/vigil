'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AgentContext } from '@agent-monitor/types';
import { CodePreview } from '@/components/Detail/CodePreview';
import { AgentForm } from './AgentForm';
import { runAgent } from '@/lib/api';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: AgentContext;
}

export function AgentModal({ isOpen, onClose, context }: AgentModalProps) {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  const handleSubmit = async (prompt: string) => {
    setIsLoading(true);
    setResponse('');

    try {
      const stream = await runAgent({ prompt, context });
      if (!stream) return;

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResponse((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch {
      setResponse('Error: Failed to run agent.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const shortPath = context.file.split('/').slice(-3).join('/');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-2xl w-full mx-4 bg-surface rounded-lg border border-border-subtle shadow-2xl shadow-black/40 animate-fade-up">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-signal">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="7" cy="7" r="2" fill="currentColor" />
              </svg>
              <h2 className="text-[14px] font-semibold text-text">Ask Agent</h2>
            </div>
            <button
              onClick={onClose}
              className="text-text-dim hover:text-text transition-colors p-1"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-text-dim">
              {shortPath} <span className="text-text-dim/50">:</span> {context.lineStart}-{context.lineEnd}
            </div>
            <CodePreview code={context.snippet} startLine={context.lineStart} />
          </div>

          {/* Form */}
          <AgentForm onSubmit={handleSubmit} isLoading={isLoading} />

          {/* Response */}
          {response && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
                Response
              </div>
              <pre className="bg-void rounded-md border border-border-subtle p-3 text-[11px] font-mono text-text-secondary overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
