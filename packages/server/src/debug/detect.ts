import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface RuntimeInfo {
  runtime: 'node' | 'tsx' | 'ts-node' | 'bun' | 'deno';
  command: string;
  runtimeArgs: string[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectRuntime(projectRoot: string): Promise<RuntimeInfo> {
  let scripts: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};

  try {
    const raw = await readFile(join(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    scripts = pkg.scripts ?? {};
    devDependencies = pkg.devDependencies ?? {};
  } catch {
    // No package.json — fall through to lockfile checks then default
  }

  const scriptValues = [scripts.start, scripts.dev, scripts.debug].filter(Boolean).join(' ');

  // bun
  if (scriptValues.includes('bun') || await fileExists(join(projectRoot, 'bun.lockb'))) {
    return { runtime: 'bun', command: 'bun', runtimeArgs: ['--inspect-brk'] };
  }

  // deno
  if (
    scriptValues.includes('deno') ||
    await fileExists(join(projectRoot, 'deno.json')) ||
    await fileExists(join(projectRoot, 'deno.jsonc'))
  ) {
    return { runtime: 'deno', command: 'deno', runtimeArgs: ['run', '--inspect-brk', '-A'] };
  }

  // tsx
  if (scriptValues.includes('tsx') || 'tsx' in devDependencies) {
    return { runtime: 'tsx', command: 'tsx', runtimeArgs: ['--inspect'] };
  }

  // ts-node
  if (scriptValues.includes('ts-node') || 'ts-node' in devDependencies) {
    return { runtime: 'ts-node', command: 'ts-node', runtimeArgs: ['--inspect'] };
  }

  // node (default)
  return { runtime: 'node', command: 'node', runtimeArgs: ['--inspect-brk'] };
}
