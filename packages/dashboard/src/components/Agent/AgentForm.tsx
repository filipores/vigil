'use client';

import { useState } from 'react';

interface AgentFormProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export function AgentForm({ onSubmit, isLoading }: AgentFormProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should the agent do with this code?"
        rows={2}
        className="w-full resize-y border border-border-subtle rounded-md p-3 text-[12px] font-mono bg-void text-text placeholder:text-text-dim focus:outline-none focus:border-signal-dim/50 transition-colors duration-150"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-dim">
          {isLoading ? 'Agent is working...' : 'Press enter or click to run'}
        </span>
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="px-4 py-1.5 text-[12px] font-medium text-void bg-signal rounded-md hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-void animate-pulse" />
              Running
            </span>
          ) : (
            'Run'
          )}
        </button>
      </div>
    </form>
  );
}
