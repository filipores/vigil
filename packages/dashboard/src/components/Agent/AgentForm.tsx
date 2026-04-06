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
        placeholder="Describe what you want the agent to do..."
        rows={3}
        className="w-full resize-y border border-border rounded-lg p-3 text-sm bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-all duration-200 ease-in-out"
      />
      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all duration-200 ease-in-out"
      >
        {isLoading ? 'Running...' : 'Run Agent'}
      </button>
    </form>
  );
}
