import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { FunctionInfo, DataFlowEdge, AnalysisResult } from '@agent-monitor/types';
import { buildAnalysisPrompt } from './prompts.js';

export interface RunAnalysisOpts {
  functions: FunctionInfo[];
  edges: DataFlowEdge[];
  allFunctions: FunctionInfo[];
  projectRoot: string;
  taskName: string;
  onProgress?: (chunk: string) => void;
}

export interface AnalysisRun {
  child: ChildProcess;
  promise: Promise<AnalysisResult[]>;
}

export function startAnalysis(opts: RunAnalysisOpts): AnalysisRun {
  const { functions, edges, allFunctions, projectRoot, taskName, onProgress } = opts;

  // Resolve 1-hop neighbors
  const targetIds = new Set(functions.map((f) => f.id));
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    if (targetIds.has(edge.sourceId)) neighborIds.add(edge.targetId);
    if (targetIds.has(edge.targetId)) neighborIds.add(edge.sourceId);
  }
  for (const id of targetIds) neighborIds.delete(id);

  const allFnMap = new Map(allFunctions.map((f) => [f.id, f]));
  const neighbors = [...neighborIds].map((id) => allFnMap.get(id)).filter(Boolean) as FunctionInfo[];

  const relevantEdges = edges.filter(
    (e) => targetIds.has(e.sourceId) || targetIds.has(e.targetId),
  );

  const prompt = buildAnalysisPrompt({
    targetFunctions: functions,
    neighbors,
    edges: relevantEdges,
    taskName,
  });

  const child = spawn('claude', ['-p', prompt, '--output-format', 'json'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const promise = new Promise<AnalysisResult[]>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Analysis timed out after 120 seconds'));
    }, 120_000);

    child.stdout!.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (onProgress) onProgress(text);
    });
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === 'ENOENT') {
        reject(new Error('claude CLI not found — is it installed and on PATH?'));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const results = parseAnalysisOutput(stdout, taskName);
        resolve(results);
      } catch (err) {
        reject(err);
      }
    });
  });

  return { child, promise };
}

function parseAnalysisOutput(raw: string, taskName: string): AnalysisResult[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Claude CLI output as JSON: ${raw.slice(0, 500)}`);
  }

  // The claude CLI --output-format json returns { result: "<string>" }
  let innerContent: string;
  if (typeof parsed.result === 'string') {
    innerContent = parsed.result;
  } else {
    innerContent = raw;
  }

  let analysisResults: Array<{
    functionId: string;
    summary: string;
    details: string;
    concerns: Array<{ severity: string; description: string; line?: number }>;
    integrationNotes: string[];
  }>;

  try {
    const jsonMatch = innerContent.match(/\{[\s\S]*"results"[\s\S]*\}/);
    if (jsonMatch) {
      const obj = JSON.parse(jsonMatch[0]);
      analysisResults = obj.results;
    } else {
      const obj = JSON.parse(innerContent) as Record<string, unknown>;
      analysisResults = obj.results as typeof analysisResults;
    }
  } catch {
    throw new Error(`Failed to extract analysis results from output: ${innerContent.slice(0, 500)}`);
  }

  if (!Array.isArray(analysisResults)) {
    throw new Error('Analysis output did not contain a "results" array');
  }

  const now = Date.now();
  return analysisResults.map((r) => ({
    id: randomUUID(),
    functionId: r.functionId,
    taskName,
    summary: r.summary ?? '',
    details: r.details ?? '',
    concerns: (r.concerns ?? []).map((c) => ({
      severity: c.severity as 'info' | 'warning' | 'critical',
      description: c.description,
      line: c.line,
    })),
    integrationNotes: r.integrationNotes ?? [],
    timestamp: now,
  }));
}
