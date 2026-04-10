import { randomUUID } from 'node:crypto';
import type { FunctionInfo, AnalysisResult, WsMessage } from '@agent-monitor/types';
import { getFunction, getAllFunctions } from '../store.js';
import { saveAnalysis } from './store.js';
import type { AnalysisEngine } from './engine.js';

export interface DuplicateMatch {
  newFunctionId: string;
  existingFunctionId: string;
  similarity: number;
  reason: string;
  confidence: 'high' | 'medium';
}

export interface DuplicateSentinel {
  checkForDuplicates(newFn: FunctionInfo, allFunctions: FunctionInfo[]): DuplicateMatch[];
  onFunctionDiscovered(functionId: string): void;
}

/**
 * Levenshtein distance between two strings, normalized to 0-1 similarity.
 */
function nameSimilarity(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();

  // Exact match
  if (la === lb) return 1;

  // Containment check
  if (la.includes(lb) || lb.includes(la)) {
    const shorter = Math.min(la.length, lb.length);
    const longer = Math.max(la.length, lb.length);
    return shorter / longer;
  }

  // Common prefix/suffix ratio
  let prefixLen = 0;
  const minLen = Math.min(la.length, lb.length);
  while (prefixLen < minLen && la[prefixLen] === lb[prefixLen]) prefixLen++;

  let suffixLen = 0;
  while (
    suffixLen < minLen &&
    la[la.length - 1 - suffixLen] === lb[lb.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const maxShared = Math.max(prefixLen, suffixLen);
  const longer = Math.max(la.length, lb.length);
  const ratio = maxShared / longer;

  if (ratio > 0.6) return ratio;

  // Fall back to Levenshtein
  return levenshteinSimilarity(la, lb);
}

function levenshteinSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  if (lenA === 0 || lenB === 0) return 0;

  // Single-row DP
  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  const distance = prev[lenB];
  const maxLen = Math.max(lenA, lenB);
  return 1 - distance / maxLen;
}

function signatureScore(a: FunctionInfo, b: FunctionInfo): number {
  let score = 0;

  // Param count match
  const paramCountMatch = a.params.length === b.params.length;
  if (!paramCountMatch) return 0;

  // Check param types
  let typesMatch = true;
  for (let i = 0; i < a.params.length; i++) {
    if (a.params[i].type !== b.params[i].type) {
      typesMatch = false;
      break;
    }
  }

  // Return type match
  const returnMatch =
    a.returnType === b.returnType ||
    (a.returnType === '' && b.returnType === '') ||
    (a.returnType === 'void' && b.returnType === 'void');

  if (typesMatch && returnMatch) {
    score = 0.5;
  } else if (typesMatch || returnMatch) {
    score = 0.25;
  }

  return score;
}

function categoryScore(a: FunctionInfo, b: FunctionInfo): number {
  return a.category === b.category ? 0.1 : 0;
}

export function createDuplicateSentinel(
  engine: AnalysisEngine,
  broadcast: (msg: WsMessage) => void,
): DuplicateSentinel {
  function checkForDuplicates(
    newFn: FunctionInfo,
    allFunctions: FunctionInfo[],
  ): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const existing of allFunctions) {
      // Skip self
      if (existing.id === newFn.id) continue;

      // Skip same file
      if (existing.filePath === newFn.filePath) continue;

      const nScore = nameSimilarity(newFn.name, existing.name);
      const sScore = signatureScore(newFn, existing);
      const cScore = categoryScore(newFn, existing);

      const combined = nScore * 0.4 + sScore * 0.4 + cScore * 0.2;

      if (combined >= 0.5) {
        const reasons: string[] = [];
        if (nScore >= 0.8) reasons.push(`${Math.round(nScore * 100)}% name similarity`);
        else if (nScore >= 0.5) reasons.push(`${Math.round(nScore * 100)}% name similarity`);
        if (sScore === 0.5) reasons.push('identical params and return type');
        else if (sScore === 0.25) reasons.push('partial signature match');
        if (cScore > 0) reasons.push(`same category (${newFn.category})`);

        matches.push({
          newFunctionId: newFn.id,
          existingFunctionId: existing.id,
          similarity: combined,
          reason: reasons.join(', '),
          confidence: combined >= 0.7 ? 'high' : 'medium',
        });
      }
    }

    // Sort by similarity descending, cap at 3
    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, 3);
  }

  function onFunctionDiscovered(functionId: string): void {
    const newFn = getFunction(functionId);
    if (!newFn) return;

    const allFns = getAllFunctions();
    const matches = checkForDuplicates(newFn, allFns);
    if (matches.length === 0) return;

    const highConfidence = matches.filter((m) => m.confidence === 'high');
    const mediumConfidence = matches.filter((m) => m.confidence === 'medium');

    // High-confidence: create analysis results immediately (no LLM)
    for (const match of highConfidence) {
      const existingFn = getFunction(match.existingFunctionId);
      const existingName = existingFn?.name ?? match.existingFunctionId;
      const existingFile = existingFn?.filePath ?? 'unknown';

      const result: AnalysisResult = {
        id: randomUUID(),
        functionId: match.newFunctionId,
        taskName: 'duplicate-detection',
        summary: `Likely duplicate of ${existingName} (${Math.round(match.similarity * 100)}% match)`,
        details: `Function "${newFn.name}" in ${newFn.filePath} appears to duplicate "${existingName}" in ${existingFile}. ${match.reason}.`,
        concerns: [
          {
            severity: 'critical',
            description: `Suspected duplicate of ${existingName} (${existingFile}:${existingFn?.line ?? '?'}): ${match.reason}`,
            line: newFn.line,
          },
        ],
        integrationNotes: [
          `Consider consolidating with ${existingName} in ${existingFile}`,
        ],
        timestamp: Date.now(),
      };

      saveAnalysis(result).then(() => {
        broadcast({
          type: 'analysis-completed',
          payload: { runId: result.id, results: [result] },
        });
      }).catch(() => {
        // Persistence failure — result was still broadcast
      });
    }

    // Medium-confidence: escalate to LLM via engine
    for (const match of mediumConfidence) {
      const existingFn = getFunction(match.existingFunctionId);
      if (!existingFn) continue;

      engine
        .triggerAnalysis([match.newFunctionId], 'duplicate-check', undefined, {
          existingFunction: existingFn,
          similarity: match.similarity,
          reason: match.reason,
        })
        .catch(() => {
          // Engine rejected (concurrency limit or dedup) — drop
        });
    }
  }

  return { checkForDuplicates, onFunctionDiscovered };
}
