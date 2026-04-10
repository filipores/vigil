import type { AnalysisEngine } from './engine.js';

const DEBOUNCE_MS = 5_000;
const HARD_CAP_MS = 30_000;

export interface AutoAnalysis {
  onFunctionEvent(functionId: string): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

export function createAutoAnalysis(engine: AnalysisEngine): AutoAnalysis {
  let enabled = false;
  let buffer: string[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hardCapTimer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (hardCapTimer) {
      clearTimeout(hardCapTimer);
      hardCapTimer = null;
    }

    if (buffer.length === 0) return;

    const ids = [...new Set(buffer)];
    buffer = [];

    engine.triggerAnalysis(ids, 'function-review').catch(() => {
      // Engine rejected (concurrency limit or dedup) — drop the batch
    });
  }

  function onFunctionEvent(functionId: string): void {
    if (!enabled) return;

    const isFirst = buffer.length === 0;
    buffer.push(functionId);

    // Reset debounce timer on every event
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);

    // Start hard cap timer on first event in the batch
    if (isFirst) {
      hardCapTimer = setTimeout(flush, HARD_CAP_MS);
    }
  }

  function setEnabled(value: boolean): void {
    enabled = value;
    if (!enabled) {
      // Clear pending timers and buffer when disabled
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (hardCapTimer) {
        clearTimeout(hardCapTimer);
        hardCapTimer = null;
      }
      buffer = [];
    }
  }

  function isEnabled(): boolean {
    return enabled;
  }

  return { onFunctionEvent, setEnabled, isEnabled };
}
