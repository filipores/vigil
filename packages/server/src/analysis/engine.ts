import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { WsMessage, AnalysisResult, RuleDefinition } from '@agent-monitor/types';
import { getAllFunctions, getFunction, getAllEdges } from '../store.js';
import { saveAnalysis, getAllAnalyses } from './store.js';
import { startAnalysis } from './runner.js';

interface RunRecord {
  child: ChildProcess;
  functionIds: string[];
}

export class AnalysisEngine {
  private running = new Map<string, RunRecord>();
  private maxConcurrent = 2;

  constructor(private broadcast: (msg: WsMessage) => void) {}

  async triggerAnalysis(functionIds: string[], taskName?: string, rules?: RuleDefinition[]): Promise<string> {
    // Server-side deduplication: reject if any requested function is already being analyzed
    for (const [runId, record] of this.running) {
      const overlap = functionIds.filter((id) => record.functionIds.includes(id));
      if (overlap.length > 0) {
        throw new Error(`Function(s) ${overlap.join(', ')} already being analyzed in run ${runId}`);
      }
    }

    if (this.running.size >= this.maxConcurrent) {
      throw new Error(`Max concurrency reached (${this.maxConcurrent}). Stop a running analysis first.`);
    }

    const functions = functionIds.map((id) => {
      const fn = getFunction(id);
      if (!fn) throw new Error(`Function not found: ${id}`);
      return fn;
    });

    const task = taskName ?? 'function-review';
    const runId = randomUUID();
    const edges = getAllEdges();
    const allFunctions = getAllFunctions();
    const projectRoot = process.cwd();

    this.broadcast({
      type: 'analysis-started',
      payload: { runId, status: 'running', progress: 'Starting analysis...', functionIds },
    });

    const onProgress = (chunk: string) => {
      this.broadcast({
        type: 'analysis-progress',
        payload: { runId, status: 'running', progress: chunk, functionIds },
      });
    };

    const { child, promise } = startAnalysis({
      functions,
      edges,
      allFunctions,
      projectRoot,
      taskName: task,
      onProgress,
      rules,
    });

    this.running.set(runId, { child, functionIds });

    this.broadcast({
      type: 'analysis-progress',
      payload: { runId, status: 'running', progress: `Analyzing ${functions.length} function(s)...`, functionIds },
    });

    // Run in background — don't await in the trigger call
    promise
      .then(async (results) => {
        this.running.delete(runId);
        for (const result of results) {
          await saveAnalysis(result);
        }
        this.broadcast({
          type: 'analysis-completed',
          payload: { runId, results },
        });
      })
      .catch((err: Error) => {
        this.running.delete(runId);
        this.broadcast({
          type: 'analysis-failed',
          payload: { runId, error: err.message },
        });
      });

    return runId;
  }

  stopAnalysis(runId: string): boolean {
    const record = this.running.get(runId);
    if (!record) return false;
    record.child.kill('SIGTERM');
    this.running.delete(runId);
    this.broadcast({
      type: 'analysis-failed',
      payload: { runId, error: 'Analysis stopped by user' },
    });
    return true;
  }

  getStatus(): { running: string[]; maxConcurrent: number } {
    return {
      running: [...this.running.keys()],
      maxConcurrent: this.maxConcurrent,
    };
  }

  getAllResults(): AnalysisResult[] {
    return getAllAnalyses();
  }
}
