'use client';

import type { GitCommit } from '@agent-monitor/types';

interface CommitListProps {
  commits: GitCommit[];
  selectedHash: string | null;
  onSelectCommit: (hash: string) => void;
}

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export function CommitList({ commits, selectedHash, onSelectCommit }: CommitListProps) {
  if (commits.length === 0) {
    return (
      <div className="p-3 py-8 text-center">
        <p className="text-[11px] text-text-dim">No commits found</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-1">
      {commits.map((commit) => (
        <button
          key={commit.hash}
          className={`w-full text-left px-2 py-2 rounded transition-colors ${
            selectedHash === commit.hash
              ? 'bg-surface-raised/50 border-l-2 border-signal'
              : 'hover:bg-surface-raised/30'
          }`}
          onClick={() => onSelectCommit(commit.hash)}
        >
          <div className="font-mono text-[10px] text-signal-dim">{commit.hash}</div>
          <div className="text-[12px] text-text truncate">{commit.message}</div>
          <div className="text-[10px] text-text-dim">
            {commit.author} &middot; {relativeDate(commit.date)}
          </div>
        </button>
      ))}
    </div>
  );
}
