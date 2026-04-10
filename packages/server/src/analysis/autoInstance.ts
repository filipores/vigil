import type { AutoAnalysis } from './auto.js';

let autoAnalysis: AutoAnalysis | null = null;

export function setAutoAnalysis(a: AutoAnalysis): void {
  autoAnalysis = a;
}

export function getAutoAnalysis(): AutoAnalysis | null {
  return autoAnalysis;
}
