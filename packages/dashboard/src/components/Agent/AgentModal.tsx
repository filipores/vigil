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

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-w-2xl w-full mx-4 bg-background rounded-xl shadow-lg border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ask Agent</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-all duration-200 ease-in-out"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-text-muted">
          {context.file} (lines {context.lineStart}-{context.lineEnd})
        </div>

        <CodePreview code={context.snippet} startLine={context.lineStart} />

        <AgentForm onSubmit={handleSubmit} isLoading={isLoading} />

        {response && (
          <pre className="bg-surface rounded-lg p-4 text-xs text-text-primary overflow-auto max-h-64 whitespace-pre-wrap">
            {response}
          </pre>
        )}
      </div>
    </div>
  );
}
