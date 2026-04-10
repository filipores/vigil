import { Hono } from 'hono';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, resolve as resolvePath, isAbsolute } from 'node:path';
import { detectRuntime, generateLaunchConfig, generateCallChainConfig } from '../debug/index.js';

export const editorRouter = new Hono();

editorRouter.post('/api/editor/open', async (c) => {
  const { filePath, line } = await c.req.json<{ filePath: string; line: number }>();

  return new Promise<Response>((resolve) => {
    const child = spawn('code', ['--goto', `${filePath}:${line}:1`], { stdio: 'ignore' });

    child.on('error', (err) => {
      resolve(c.json({ error: err.message }, 500));
    });

    child.on('close', () => {
      resolve(c.json({ ok: true }));
    });
  });
});

interface DebugRequestBody {
  filePath: string;
  line: number;
  functionName: string;
  projectRoot?: string;
  callChain?: Array<{ filePath: string; line: number; name: string }>;
}

function deriveProjectRoot(filePath: string): string {
  const parts = filePath.split('/');
  const srcIdx = parts.lastIndexOf('src');
  if (srcIdx > 0) {
    return parts.slice(0, srcIdx).join('/');
  }
  return dirname(filePath);
}

editorRouter.post('/api/editor/debug', async (c) => {
  try {
    const body = await c.req.json<DebugRequestBody>();
    const { filePath, line, functionName, callChain } = body;
    const projectRoot = body.projectRoot ?? deriveProjectRoot(filePath);

    // Validate projectRoot is an absolute path and exists as a directory
    if (!isAbsolute(projectRoot)) {
      return c.json({ error: 'projectRoot must be an absolute path' }, 400);
    }
    try {
      const s = await stat(projectRoot);
      if (!s.isDirectory()) {
        return c.json({ error: 'projectRoot is not a directory' }, 400);
      }
    } catch {
      return c.json({ error: 'projectRoot does not exist' }, 400);
    }

    // Validate filePath is within projectRoot
    const resolvedFile = resolvePath(projectRoot, filePath);
    if (!resolvedFile.startsWith(projectRoot + '/') && resolvedFile !== projectRoot) {
      return c.json({ error: 'filePath must be within projectRoot' }, 400);
    }

    const runtime = await detectRuntime(projectRoot);

    const result = callChain && callChain.length > 0
      ? generateCallChainConfig({
          runtime,
          functions: callChain,
          projectRoot,
          entryFilePath: filePath,
        })
      : generateLaunchConfig({
          runtime,
          filePath,
          line,
          projectRoot,
          functionName,
        });

    // Write/merge into .vscode/launch.json
    const vscodeDir = join(projectRoot, '.vscode');
    const launchPath = join(vscodeDir, 'launch.json');

    await mkdir(vscodeDir, { recursive: true });

    let launchJson: { version: string; configurations: Array<{ name: string; [k: string]: unknown }> };
    try {
      const existing = await readFile(launchPath, 'utf-8');
      launchJson = JSON.parse(existing);
      if (!Array.isArray(launchJson.configurations)) {
        launchJson.configurations = [];
      }
    } catch {
      launchJson = { version: '0.2.0', configurations: [] };
    }

    // Merge by name: update existing Vigil config or append
    const idx = launchJson.configurations.findIndex((cfg) => cfg.name === result.config.name);
    if (idx >= 0) {
      launchJson.configurations[idx] = result.config;
    } else {
      launchJson.configurations.push(result.config);
    }

    await writeFile(launchPath, JSON.stringify(launchJson, null, 2) + '\n', 'utf-8');

    // Best-effort: open the file in VS Code
    spawn('code', ['--goto', `${filePath}:${line}:1`], { stdio: 'ignore' });

    return c.json({
      ok: true,
      runtime: runtime.runtime,
      config: result.config,
      breakpoints: result.breakpoints,
      launchJsonPath: launchPath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});
