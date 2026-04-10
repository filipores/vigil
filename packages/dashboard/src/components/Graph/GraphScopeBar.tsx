'use client';

import type { ScopeMode } from '@/hooks/useGraphScope';
import type { FunctionInfo } from '@agent-monitor/types';

interface GraphScopeBarProps {
  scopeMode: ScopeMode;
  totalCount: number;
  scopedCount: number;
  clearScope: () => void;
  functions: FunctionInfo[];
  commitHash?: string | null;
}

export function GraphScopeBar({
  scopeMode,
  totalCount,
  scopedCount,
  clearScope,
  functions,
  commitHash,
}: GraphScopeBarProps) {
  if (scopeMode.type === 'all') {
    if (totalCount <= 300) return null;
    return (
      <div className="flex items-center gap-2 h-7 px-4 bg-surface-raised/50 border-b border-border-subtle shrink-0">
        <span className="text-[11px] text-text-dim">
          Showing all {totalCount} functions
        </span>
      </div>
    );
  }

  let label = '';
  let detail = '';

  switch (scopeMode.type) {
    case 'focus': {
      const fn = functions.find((f) => f.id === scopeMode.functionId);
      const name = fn?.name ?? 'unknown';
      label = 'Focus';
      detail = `${name} (${scopeMode.hops}-hop neighborhood) — ${scopedCount} functions`;
      break;
    }
    case 'commit': {
      const shortHash = commitHash ? commitHash.slice(0, 7) : '???';
      label = 'Commit';
      detail = `${shortHash} — ${scopedCount} functions changed`;
      break;
    }
    case 'category': {
      const names = Array.from(scopeMode.categories).join(', ');
      label = 'Filter';
      detail = `${names} — ${scopedCount} functions`;
      break;
    }
  }

  return (
    <div className="flex items-center gap-2 h-7 px-4 bg-surface-raised/50 border-b border-border-subtle shrink-0">
      <span className="text-[11px] font-medium text-signal">{label}</span>
      <span className="text-[11px] text-text-secondary">{detail}</span>
      <button
        onClick={clearScope}
        className="ml-auto flex items-center gap-1 text-[10px] text-text-dim hover:text-text transition-colors"
      >
        Clear
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M3 3l4 4M7 3l-4 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
