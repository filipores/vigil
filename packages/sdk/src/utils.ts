import { createHash } from 'node:crypto';
import path from 'node:path';

export function generateId(filePath: string, name: string, line: number): string {
  return createHash('sha1')
    .update(`${filePath}:${name}:${line}`)
    .digest('hex')
    .slice(0, 12);
}

export function normalizePath(p: string): string {
  return path.resolve(p);
}
