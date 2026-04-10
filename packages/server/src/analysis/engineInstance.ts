import { AnalysisEngine } from './engine.js';

let engine: AnalysisEngine | null = null;

export function setAnalysisEngine(e: AnalysisEngine): void {
  engine = e;
}

export function getAnalysisEngine(): AnalysisEngine | null {
  return engine;
}
