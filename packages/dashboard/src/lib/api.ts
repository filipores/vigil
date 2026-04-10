import type { FunctionInfo, FileChange, AgentCommand, GitCommit, CommitDiff, DataFlowEdge, CanvasLayout, AnalysisResult } from '@agent-monitor/types';
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

export async function fetchAnalysisResults(functionId?: string): Promise<AnalysisResult[]> {
  const params = functionId ? `?functionId=${functionId}` : '';
  const res = await fetch(`${API_BASE}/api/analysis/results${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function triggerAnalysisRequest(
  functionIds: string[],
  taskName?: string,
): Promise<{ runId: string; status: string }> {
  const res = await fetch(`${API_BASE}/api/analysis/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functionIds, taskName }),
  });
  if (!res.ok) throw new Error('Failed to trigger analysis');
  return res.json();
}

export async function stopAnalysisRequest(runId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/analysis/stop/${runId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to stop analysis');
  return res.json();
}

export async function setAutoAnalysis(enabled: boolean): Promise<void> {
  await fetch(`${API_BASE}/api/analysis/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}

export async function getAutoAnalysis(): Promise<{ enabled: boolean }> {
  const res = await fetch(`${API_BASE}/api/analysis/auto`);
  if (!res.ok) return { enabled: false };
  return res.json();
}

export async function launchDebugSession(opts: {
  filePath: string;
  line: number;
  functionName: string;
  projectRoot?: string;
  callChain?: Array<{ filePath: string; line: number; name: string }>;
}): Promise<{ config: object; breakpoints: Array<{ filePath: string; line: number }> }> {
  const res = await fetch(`${API_BASE}/api/editor/debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}
