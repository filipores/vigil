import type { FunctionInfo, FileChange, AgentCommand, GitCommit, CommitDiff, DataFlowEdge, CanvasLayout } from '@agent-monitor/types';
import { API_BASE } from './constants';

export async function fetchFunctions(): Promise<FunctionInfo[]> {
  const res = await fetch(`${API_BASE}/api/functions`);
  if (!res.ok) throw new Error('Failed to fetch functions');
  return res.json();
}

export async function fetchFiles(): Promise<FileChange[]> {
  const res = await fetch(`${API_BASE}/api/files`);
  if (!res.ok) throw new Error('Failed to fetch files');
  return res.json();
}

export async function openInEditor(filePath: string, line: number): Promise<void> {
  await fetch(`${API_BASE}/api/editor/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, line }),
  });
}

export async function runAgent(command: AgentCommand): Promise<ReadableStream<Uint8Array> | null> {
  const res = await fetch(`${API_BASE}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.body;
}

export async function fetchCommits(limit = 20): Promise<GitCommit[]> {
  const res = await fetch(`${API_BASE}/api/git/commits?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCommitDiff(hash: string): Promise<CommitDiff | null> {
  const res = await fetch(`${API_BASE}/api/git/commits/${encodeURIComponent(hash)}/diff`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchEdges(): Promise<DataFlowEdge[]> {
  const res = await fetch(`${API_BASE}/api/edges`);
  if (!res.ok) return [];
  return res.json();
}

export async function runCanvasAgent(
  prompt: string,
  graph: { functions: FunctionInfo[]; edges: DataFlowEdge[]; canvasLayout: CanvasLayout },
): Promise<ReadableStream<Uint8Array> | null> {
  const res = await fetch(`${API_BASE}/api/agent/canvas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, graph }),
  });
  return res.body;
}
