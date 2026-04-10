import type { DuplicateSentinel } from './duplicates.js';

let sentinel: DuplicateSentinel | null = null;

export function setDuplicateSentinel(s: DuplicateSentinel): void {
  sentinel = s;
}

export function getDuplicateSentinel(): DuplicateSentinel | null {
  return sentinel;
}
