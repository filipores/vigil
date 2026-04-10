import type { FunctionInfo, GitCommit, CommitDiff } from '@agent-monitor/types';
import { fetchCommits, fetchCommitDiff } from '$lib/api';

let commits = $state<GitCommit[]>([]);
let selectedHash = $state<string | null>(null);
let commitDiff = $state<CommitDiff | null>(null);
let highlightedFunctionIds = $state<Set<string>>(new Set());
let isLoadingDiff = $state(false);
let latestRequest: string | null = null;
let initialized = false;

export function initGitCommits() {
  if (initialized) return;
  initialized = true;
  fetchCommits().then((c) => { commits = c; }).catch(() => {});
}

export async function selectCommit(hash: string, functions: FunctionInfo[]) {
  if (hash === selectedHash) return;
  selectedHash = hash;
  isLoadingDiff = true;
  latestRequest = hash;

  const diff = await fetchCommitDiff(hash);
  if (latestRequest !== hash) return;
  commitDiff = diff;

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
    highlightedFunctionIds = matched;
  } else {
    highlightedFunctionIds = new Set();
  }

  isLoadingDiff = false;
}

export function clearCommit() {
  selectedHash = null;
  commitDiff = null;
  highlightedFunctionIds = new Set();
}

export function getGitCommitsStore() {
  return {
    get commits() { return commits; },
    get selectedHash() { return selectedHash; },
    get commitDiff() { return commitDiff; },
    get highlightedFunctionIds() { return highlightedFunctionIds; },
    get isLoadingDiff() { return isLoadingDiff; },
    selectCommit,
    clearCommit,
  };
}
