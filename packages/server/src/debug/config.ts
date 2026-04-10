import type { RuntimeInfo } from './detect.js';

export interface Breakpoint {
  filePath: string;
  line: number;
}

interface LaunchConfigBase {
  [key: string]: unknown;
  name: string;
  type: string;
  request: 'launch';
  program: string;
  cwd: string;
  console: 'integratedTerminal';
  skipFiles: string[];
  sourceMaps?: boolean;
  runtimeExecutable?: string;
  runtimeArgs?: string[];
}

function buildBaseConfig(opts: {
  runtime: RuntimeInfo;
  filePath: string;
  projectRoot: string;
  functionName: string;
}): LaunchConfigBase {
  const { runtime, filePath, projectRoot, functionName } = opts;
  const name = `Vigil: Debug ${functionName}`;

  const base: LaunchConfigBase = {
    name,
    type: 'node',
    request: 'launch',
    program: filePath,
    cwd: projectRoot,
    console: 'integratedTerminal',
    skipFiles: ['<node_internals>/**'],
  };

  switch (runtime.runtime) {
    case 'node':
      break;

    case 'tsx':
      base.runtimeExecutable = 'tsx';
      base.sourceMaps = true;
      break;

    case 'ts-node':
      base.runtimeExecutable = 'ts-node';
      base.sourceMaps = true;
      break;

    case 'bun':
      base.type = 'bun';
      break;

    case 'deno':
      base.runtimeExecutable = 'deno';
      base.runtimeArgs = ['run', '--inspect-brk', '-A'];
      base.sourceMaps = true;
      break;
  }

  return base;
}

export function generateLaunchConfig(opts: {
  runtime: RuntimeInfo;
  filePath: string;
  line: number;
  projectRoot: string;
  functionName: string;
}): { config: LaunchConfigBase; breakpoints: Breakpoint[] } {
  const config = buildBaseConfig(opts);
  const breakpoints: Breakpoint[] = [{ filePath: opts.filePath, line: opts.line }];
  return { config, breakpoints };
}

export function generateCallChainConfig(opts: {
  runtime: RuntimeInfo;
  functions: Array<{ filePath: string; line: number; name: string }>;
  projectRoot: string;
  entryFilePath: string;
}): { config: LaunchConfigBase; breakpoints: Breakpoint[] } {
  const names = opts.functions.map((f) => f.name).join(' → ');
  const config = buildBaseConfig({
    runtime: opts.runtime,
    filePath: opts.entryFilePath,
    projectRoot: opts.projectRoot,
    functionName: names,
  });

  const breakpoints: Breakpoint[] = opts.functions.map((f) => ({
    filePath: f.filePath,
    line: f.line,
  }));

  return { config, breakpoints };
}
