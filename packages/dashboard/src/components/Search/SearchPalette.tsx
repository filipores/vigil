'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { FunctionInfo } from '@agent-monitor/types';

export interface SearchPaletteProps {
  functions: FunctionInfo[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (functionId: string) => void;
}

interface ScoredResult {
  fn: FunctionInfo;
  score: number;
}

function fuzzyMatch(query: string, target: string): number {
  const lowerTarget = target.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact prefix match — highest score
  if (lowerTarget.startsWith(lowerQuery)) return 3;

  // Contains substring — medium score
  if (lowerTarget.includes(lowerQuery)) return 2;

  // Fuzzy character match — check if chars appear in order
  let qi = 0;
  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) qi++;
  }
  if (qi === lowerQuery.length) return 1;

  return 0;
}

function scoreFn(query: string, fn: FunctionInfo): number {
  const nameScore = fuzzyMatch(query, fn.name);
  const pathScore = fuzzyMatch(query, fn.filePath);
  const catScore = fuzzyMatch(query, fn.category);

  // Name matches are weighted highest, path next, category last
  return nameScore * 3 + pathScore * 2 + catScore;
}

export function SearchPalette({ functions, isOpen, onClose, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return functions.slice(0, 20);

    const scored: ScoredResult[] = [];
    for (const fn of functions) {
      const s = scoreFn(query, fn);
      if (s > 0) scored.push({ fn, score: s });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map((r) => r.fn);
  }, [functions, query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Reset query when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a tick to ensure mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleConfirm = useCallback(
    (index: number) => {
      const fn = results[index];
      if (fn) {
        onSelect(fn.id);
        onClose();
      }
    },
    [results, onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          handleConfirm(selectedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results.length, selectedIndex, handleConfirm, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-surface-raised border border-border-subtle rounded-xl shadow-2xl animate-fade-up"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search functions and files..."
          className="w-full p-4 text-lg bg-surface text-text border-b border-border-subtle rounded-t-xl outline-none placeholder:text-text-dim"
        />

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-text-dim text-sm">
              No matching functions
            </div>
          )}
          {results.map((fn, i) => (
            <div
              key={fn.id}
              onClick={() => handleConfirm(i)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-4 py-2 cursor-pointer flex items-center justify-between gap-3 ${
                i === selectedIndex
                  ? 'bg-surface border-l-2 border-signal'
                  : 'hover:bg-surface border-l-2 border-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-text font-medium truncate">{fn.name}</div>
                <div className="text-text-secondary text-sm truncate">{fn.filePath}</div>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-text-dim shrink-0">
                {fn.category}
              </span>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border-subtle text-text-dim text-[11px]">
          <span><kbd className="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">&uarr;&darr;</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">enter</kbd> select</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
