'use client';

import { useState, useRef, useCallback } from 'react';
import type { FunctionInfo, DataFlowEdge, CanvasLayout, CanvasCommand } from '@agent-monitor/types';
import { runCanvasAgent } from '@/lib/api';

interface CanvasAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (cmd: CanvasCommand) => void;
  functions: FunctionInfo[];
  edges: DataFlowEdge[];
  layout: CanvasLayout;
}

interface CommandEntry {
  id: number;
  cmd: CanvasCommand;
}

export function CanvasAgentPanel({ isOpen, onClose, onCommand, functions, edges, layout }: CanvasAgentPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [commands, setCommands] = useState<CommandEntry[]>([]);
  const [running, setRunning] = useState(false);
  const counterRef = useRef(0);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setCommands([]);

    try {
      const stream = await runCanvasAgent(prompt, { functions, edges, canvasLayout: layout });
      if (!stream) { setRunning(false); return; }

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.type === 'string') {
              const id = ++counterRef.current;
              setCommands((prev) => [...prev, { id, cmd: parsed as CanvasCommand }]);
              onCommand(parsed as CanvasCommand);
            }
          } catch {
            // not JSON, skip
          }
        }
      }
    } catch {
      // stream error
    } finally {
      setRunning(false);
    }
  }, [prompt, running, functions, edges, layout, onCommand]);

  if (!isOpen) return null;

  return (
    <div className="w-72 border-l border-border-subtle bg-surface h-full overflow-y-auto shrink-0 flex flex-col">
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-dim">
            Agent Harness
          </span>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text transition-colors p-1 -mr-1"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Prompt */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Describe layout changes..."
          className="w-full text-[11px] font-mono bg-void border border-border-subtle rounded px-2 py-1.5 text-text placeholder:text-text-dim/50 resize-none focus:outline-none focus:border-signal/40"
        />

        {/* Run */}
        <button
          onClick={handleRun}
          disabled={running || !prompt.trim()}
          className="w-full px-3 py-1.5 text-[11px] font-medium bg-signal text-void rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? 'Running...' : 'Run'}
        </button>

        {/* Commands */}
        {commands.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
              Commands
            </span>
            {commands.map((entry) => (
              <div
                key={entry.id}
                className="text-[10px] font-mono bg-void/50 border border-border-subtle rounded px-2 py-1 text-signal-dim"
              >
                {entry.cmd.type}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
