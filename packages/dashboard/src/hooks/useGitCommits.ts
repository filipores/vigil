'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FunctionInfo, GitCommit, CommitDiff } from '@agent-monitor/types';
import { fetchCommits, fetchCommitDiff } from '@/lib/api';

export function useGitCommits(functions: FunctionInfo[]) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [commitDiff, setCommitDiff] = useState<CommitDiff | null>(null);
  const [highlightedFunctionIds, setHighlightedFunctionIds] = useState<Set<string>>(new Set());
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const latestRequestRef = useRef<string | null>(null);

  useEffect(() => {
    fetchCommits().then(setCommits).catch(() => {});
  }, []);

  const selectCommit = useCallback(
    async (hash: string) => {
      if (hash === selectedHash) return;
      setSelectedHash(hash);
      setIsLoadingDiff(true);
      latestRequestRef.current = hash;

      const diff = await fetchCommitDiff(hash);
      if (latestRequestRef.current !== hash) return;
      setCommitDiff(diff);

      if (diff) {
        const changedPaths = diff.diffs.map((d) => d.filePath);
        const matched = new Set<string>();
        for (const fn of functions) {
          for (const cp of changedPaths) {
            if (cp.endsWith(fn.filePath) || fn.filePath.endsWith(cp)) {
              matched.add(fn.id);
              break;
            }
          }
        }
        setHighlightedFunctionIds(matched);
      } else {
        setHighlightedFunctionIds(new Set());
      }

      setIsLoadingDiff(false);
    },
    [selectedHash, functions],
  );

  const clearCommit = useCallback(() => {
    setSelectedHash(null);
    setCommitDiff(null);
    setHighlightedFunctionIds(new Set());
  }, []);

  return useMemo(
    () => ({
      commits,
      selectedHash,
      commitDiff,
      highlightedFunctionIds,
      selectCommit,
      clearCommit,
      isLoadingDiff,
    }),
    [commits, selectedHash, commitDiff, highlightedFunctionIds, selectCommit, clearCommit, isLoadingDiff],
  );
}
