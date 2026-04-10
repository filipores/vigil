#!/usr/bin/env node

import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitor } from '@agent-monitor/sdk';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let projectPath = process.cwd();
let serverPort = 3001;
let dashboardPort = 3000;
let startDashboard = true;
let autoOpen = true;
let previewMode = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--port') {
    serverPort = Number(args[++i]);
  } else if (arg === '--dashboard-port') {
    dashboardPort = Number(args[++i]);
  } else if (arg === '--no-dashboard') {
    startDashboard = false;
  } else if (arg === '--no-open') {
    autoOpen = false;
  } else if (arg === '--preview') {
    previewMode = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: vigil [project-path] [options]

Options:
  --port <number>            Server port (default: 3001)
  --dashboard-port <number>  Dashboard port (default: 3000)
  --no-dashboard             Skip starting the dashboard
  --no-open                  Don't auto-open the browser
  --preview                  Use vite preview instead of vite dev
  -h, --help                 Show this help message
`);
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    projectPath = path.resolve(arg);
  }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPkgDir = path.resolve(__dirname, '..');
const packagesDir = path.resolve(cliPkgDir, '..');
const serverEntry = path.resolve(packagesDir, 'server', 'dist', 'index.js');
const dashboardDir = path.resolve(packagesDir, 'dashboard');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const children: ChildProcess[] = [];

function prefixStream(proc: ChildProcess, label: string) {
  const prefix = `\x1b[2m[${label}]\x1b[0m `;
  proc.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line) process.stdout.write(prefix + line + '\n');
    }
  });
  proc.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      if (line) process.stderr.write(prefix + line + '\n');
    }
  });
}

function openBrowser(url: string) {
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const serverProc = spawn('node', [serverEntry], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(serverPort) },
});
children.push(serverProc);
prefixStream(serverProc, 'server');

// ---------------------------------------------------------------------------
// Start SDK monitor
// ---------------------------------------------------------------------------

const serverUrl = `ws://localhost:${serverPort}/ws`;
let sdkHandle: { stop: () => void } | null = null;

// Give the server a moment to bind before the SDK connects
setTimeout(() => {
  sdkHandle = monitor({ root: projectPath, serverUrl });
  console.log(`\x1b[2m[sdk]\x1b[0m Watching ${projectPath}`);
}, 500);

// ---------------------------------------------------------------------------
// Start dashboard
// ---------------------------------------------------------------------------

let dashboardProc: ChildProcess | null = null;

if (startDashboard) {
  const viteCmd = previewMode ? 'preview' : 'dev';
  dashboardProc = spawn('npx', ['vite', viteCmd, '--port', String(dashboardPort)], {
    cwd: dashboardDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  children.push(dashboardProc);
  prefixStream(dashboardProc, 'dashboard');

  if (autoOpen) {
    setTimeout(() => {
      openBrowser(`http://localhost:${dashboardPort}`);
    }, 2000);
  }
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

const monPath = projectPath.length > 35 ? '...' + projectPath.slice(-32) : projectPath;
const serverUrl_ = `http://localhost:${serverPort}`;
const dashUrl = `http://localhost:${dashboardPort}`;

const lines = [
  '',
  '  Vigil — AI Code Monitor',
  '',
  `  Monitoring: ${monPath}`,
  `  Server:     ${serverUrl_}`,
];
if (startDashboard) {
  lines.push(`  Dashboard:  ${dashUrl}`);
}
lines.push('');

const maxLen = Math.max(...lines.map((l) => l.length));
const pad = (s: string) => s + ' '.repeat(maxLen - s.length);

console.log();
console.log(`  \x1b[36m╭${'─'.repeat(maxLen + 2)}╮\x1b[0m`);
for (const line of lines) {
  console.log(`  \x1b[36m│\x1b[0m ${pad(line)} \x1b[36m│\x1b[0m`);
}
console.log(`  \x1b[36m╰${'─'.repeat(maxLen + 2)}╯\x1b[0m`);
console.log();

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown() {
  console.log('\nVigil stopped.');
  sdkHandle?.stop();
  for (const child of children) {
    child.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

serverProc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`\x1b[2m[server]\x1b[0m exited with code ${code}`);
  }
});

if (dashboardProc) {
  dashboardProc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`\x1b[2m[dashboard]\x1b[0m exited with code ${code}`);
    }
  });
}
