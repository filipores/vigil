import type { FunctionCategory } from '@agent-monitor/types';

export function categorize(
  name: string,
  filePath: string,
  isAsync: boolean,
  isClassMethod: boolean,
): FunctionCategory {
  // First match wins
  if (isClassMethod) return 'class-method';
  if (/^use[A-Z]/.test(name) || name === 'use') return 'hook';
  if (/^[A-Z]/.test(name) && /\.(tsx|jsx)$/.test(filePath)) return 'component';
  if (/^handle[A-Z]/.test(name) || (/^on[A-Z]/.test(name)) || name.endsWith('Handler')) return 'handler';
  if (/\/(api)\//i.test(filePath) || /^(fetch|get|post|put|patch|delete|load|request)/i.test(name)) return 'api';
  if (/\/(utils?|helpers?|libs?)\//i.test(filePath)) return 'util';
  if (isAsync) return 'async';
  return 'function';
}
