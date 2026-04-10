import { writeFile, readFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisResult } from '@agent-monitor/types';

const analyses = new Map<string, AnalysisResult>();
let persistPath = '';

export async function initAnalysisStore(dataDir?: string): Promise<void> {
  const dir = dataDir ?? join(process.cwd(), '.vigil');
  await mkdir(dir, { recursive: true });
  persistPath = join(dir, 'analysis.json');

  try {
    const raw = await readFile(persistPath, 'utf-8');
    const items: AnalysisResult[] = JSON.parse(raw);
    for (const item of items) {
      analyses.set(item.id, item);
    }
  } catch {
    // File doesn't exist yet or is invalid — start empty
  }
}

async function persist(): Promise<void> {
  if (!persistPath) return;
  const tmp = persistPath + '.tmp';
  const data = JSON.stringify(getAllAnalyses(), null, 2);
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, persistPath);
}

export async function saveAnalysis(result: AnalysisResult): Promise<void> {
  analyses.set(result.id, result);
  await persist();
}

export function getAnalysis(id: string): AnalysisResult | undefined {
  return analyses.get(id);
}

export function getAnalysesByFunction(functionId: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  for (const a of analyses.values()) {
    if (a.functionId === functionId) results.push(a);
  }
  return results;
}

export function getAllAnalyses(): AnalysisResult[] {
  return [...analyses.values()];
}

export async function deleteAnalysis(id: string): Promise<void> {
  analyses.delete(id);
  await persist();
}
