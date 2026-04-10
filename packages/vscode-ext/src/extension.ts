import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';

let serverProcess: ChildProcess | undefined;
let sdkProcess: ChildProcess | undefined;
let statusBarItem: vscode.StatusBarItem;
let pollInterval: ReturnType<typeof setInterval> | undefined;
let outputChannel: vscode.OutputChannel;

interface FunctionInfo {
  id: string;
  name: string;
  filePath: string;
  line: number;
  endLine: number;
}

function getConfig() {
  const config = vscode.workspace.getConfiguration('vigil');
  return {
    autoStart: config.get<boolean>('autoStart', true),
    serverPort: config.get<number>('serverPort', 3001),
    dashboardPort: config.get<number>('dashboardPort', 3000),
  };
}

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function findServerEntry(workspaceRoot: string): string {
  // In the monorepo, the server dist is at packages/server/dist/index.js
  // relative to the workspace root. Also check a few common locations.
  const candidates = [
    join(workspaceRoot, 'packages', 'server', 'dist', 'index.js'),
    join(workspaceRoot, 'node_modules', '@agent-monitor', 'server', 'dist', 'index.js'),
  ];
  return candidates[0];
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpPost(url: string, body: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = httpRequest(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function waitForServer(port: number, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await httpGet(`http://localhost:${port}/api/functions`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

async function startServer(): Promise<boolean> {
  if (serverProcess && !serverProcess.killed) {
    outputChannel.appendLine('Server already running');
    return true;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Vigil: No workspace folder open');
    return false;
  }

  const { serverPort } = getConfig();
  const serverEntry = findServerEntry(workspaceRoot);

  outputChannel.appendLine(`Starting Vigil server: node ${serverEntry}`);

  try {
    serverProcess = spawn('node', [serverEntry], {
      cwd: workspaceRoot,
      env: { ...process.env, PORT: String(serverPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      outputChannel.appendLine(`[server] ${data.toString().trimEnd()}`);
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      outputChannel.appendLine(`[server:err] ${data.toString().trimEnd()}`);
    });

    serverProcess.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        vscode.window.showErrorMessage('Vigil: Node.js not found. Make sure "node" is in your PATH.');
      } else {
        vscode.window.showErrorMessage(`Vigil: Server failed to start: ${err.message}`);
      }
      serverProcess = undefined;
    });

    serverProcess.on('exit', (code) => {
      outputChannel.appendLine(`Server exited with code ${code}`);
      serverProcess = undefined;
    });

    updateStatusBar('starting');
    const ready = await waitForServer(serverPort);
    if (!ready) {
      vscode.window.showErrorMessage('Vigil: Server failed to become ready (port may be in use)');
      killProcess(serverProcess);
      serverProcess = undefined;
      updateStatusBar('stopped');
      return false;
    }

    outputChannel.appendLine('Server is ready');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Vigil: Failed to start server: ${msg}`);
    return false;
  }
}

function startSDK(): void {
  if (sdkProcess && !sdkProcess.killed) {
    outputChannel.appendLine('SDK already running');
    return;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const { serverPort } = getConfig();
  const sdkEntry = join(workspaceRoot, 'packages', 'sdk', 'dist', 'index.js');

  // Use a small inline script to call the monitor function.
  // Pass paths via environment variables to avoid escaping issues.
  const script = [
    `import('file://' + process.env.VIGIL_SDK_ENTRY)`,
    `.then(m => m.monitor({ root: process.env.VIGIL_ROOT, serverUrl: 'ws://localhost:${serverPort}/ws' }))`,
    `.catch(e => { console.error(e); process.exit(1); });`,
  ].join('');

  outputChannel.appendLine('Starting Vigil SDK monitor');

  sdkProcess = spawn('node', ['--input-type=module', '-e', script], {
    cwd: workspaceRoot,
    env: { ...process.env, VIGIL_ROOT: workspaceRoot, VIGIL_SDK_ENTRY: sdkEntry },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  sdkProcess.stdout?.on('data', (data: Buffer) => {
    outputChannel.appendLine(`[sdk] ${data.toString().trimEnd()}`);
  });

  sdkProcess.stderr?.on('data', (data: Buffer) => {
    outputChannel.appendLine(`[sdk:err] ${data.toString().trimEnd()}`);
  });

  sdkProcess.on('error', (err) => {
    vscode.window.showWarningMessage(`Vigil: SDK failed to start: ${err.message}`);
    sdkProcess = undefined;
  });

  sdkProcess.on('exit', (code) => {
    outputChannel.appendLine(`SDK exited with code ${code}`);
    sdkProcess = undefined;
  });
}

function killProcess(proc: ChildProcess | undefined): void {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    // Force-kill after 3 seconds if still alive
    setTimeout(() => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 3000);
  }
}

function updateStatusBar(state: 'starting' | 'running' | 'stopped', functionCount?: number): void {
  switch (state) {
    case 'starting':
      statusBarItem.text = '$(eye) Vigil: starting...';
      statusBarItem.tooltip = 'Vigil server is starting';
      break;
    case 'running':
      statusBarItem.text = functionCount !== undefined
        ? `$(eye) Vigil: ${functionCount} functions`
        : '$(eye) Vigil';
      statusBarItem.tooltip = 'Click to open Vigil dashboard';
      break;
    case 'stopped':
      statusBarItem.text = '$(eye) Vigil: stopped';
      statusBarItem.tooltip = 'Click to start Vigil';
      break;
  }
}

function startPolling(): void {
  if (pollInterval) return;
  const { serverPort } = getConfig();

  pollInterval = setInterval(async () => {
    try {
      const data = await httpGet(`http://localhost:${serverPort}/api/functions`);
      const functions: FunctionInfo[] = JSON.parse(data);
      updateStatusBar('running', functions.length);
    } catch {
      // Server might have gone away
      if (!serverProcess || serverProcess.killed) {
        updateStatusBar('stopped');
      }
    }
  }, 5000);
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = undefined;
  }
}

async function fetchFunctions(): Promise<FunctionInfo[]> {
  const { serverPort } = getConfig();
  try {
    const data = await httpGet(`http://localhost:${serverPort}/api/functions`);
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function findFunctionAtCursor(functions: FunctionInfo[], filePath: string, line: number): FunctionInfo | undefined {
  // Find the most specific (innermost) function containing the cursor line
  const matching = functions.filter(
    (f) => f.filePath === filePath && line >= f.line && line <= (f.endLine ?? f.line),
  );
  if (matching.length === 0) return undefined;
  // Return the one with the smallest range (most specific)
  matching.sort((a, b) => ((a.endLine ?? a.line) - a.line) - ((b.endLine ?? b.line) - b.line));
  return matching[0];
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Vigil');

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'vigil.openDashboard';
  updateStatusBar('stopped');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vigil.openDashboard', () => {
      const { dashboardPort } = getConfig();
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${dashboardPort}`));
    }),

    vscode.commands.registerCommand('vigil.analyzeFunction', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Vigil: No active editor');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const line = editor.selection.active.line + 1; // VS Code is 0-indexed, Vigil is 1-indexed
      const functions = await fetchFunctions();
      const fn = findFunctionAtCursor(functions, filePath, line);

      if (!fn) {
        vscode.window.showWarningMessage('Vigil: No monitored function found at cursor position');
        return;
      }

      const { serverPort } = getConfig();
      try {
        await httpPost(`http://localhost:${serverPort}/api/analysis/trigger`, {
          functionIds: [fn.id],
        });
        vscode.window.showInformationMessage(`Vigil: Analysis started for ${fn.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Vigil: Failed to trigger analysis: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('vigil.debugFunction', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Vigil: No active editor');
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Vigil: No workspace folder open');
        return;
      }

      const filePath = editor.document.uri.fsPath;
      const line = editor.selection.active.line + 1;
      const functions = await fetchFunctions();
      const fn = findFunctionAtCursor(functions, filePath, line);

      if (!fn) {
        vscode.window.showWarningMessage('Vigil: No monitored function found at cursor position');
        return;
      }

      const { serverPort } = getConfig();
      try {
        const responseData = await httpPost(`http://localhost:${serverPort}/api/editor/debug`, {
          filePath: fn.filePath,
          line: fn.line,
          functionName: fn.name,
          projectRoot: workspaceFolder.uri.fsPath,
        });

        const result = JSON.parse(responseData) as {
          ok?: boolean;
          error?: string;
          config?: vscode.DebugConfiguration;
          breakpoints?: Array<{ filePath: string; line: number }>;
        };

        if (!result.ok || !result.config) {
          vscode.window.showErrorMessage(`Vigil: Debug config generation failed: ${result.error ?? 'unknown error'}`);
          return;
        }

        // Set breakpoints
        if (result.breakpoints && result.breakpoints.length > 0) {
          const bps = result.breakpoints.map((bp) => {
            const uri = vscode.Uri.file(bp.filePath);
            const position = new vscode.Position(bp.line - 1, 0);
            const location = new vscode.Location(uri, position);
            return new vscode.SourceBreakpoint(location);
          });
          vscode.debug.addBreakpoints(bps);
        }

        // Start debugging
        const started = await vscode.debug.startDebugging(workspaceFolder, result.config);
        if (started) {
          vscode.window.showInformationMessage(`Vigil: Debugging ${fn.name}`);
        } else {
          vscode.window.showWarningMessage('Vigil: Debug session failed to start');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Vigil: Debug failed: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('vigil.start', async () => {
      const ok = await startServer();
      if (ok) {
        startSDK();
        startPolling();
        updateStatusBar('running');
        vscode.window.showInformationMessage('Vigil: Server and SDK started');
      }
    }),

    vscode.commands.registerCommand('vigil.stop', () => {
      stopPolling();
      killProcess(sdkProcess);
      sdkProcess = undefined;
      killProcess(serverProcess);
      serverProcess = undefined;
      updateStatusBar('stopped');
      vscode.window.showInformationMessage('Vigil: Stopped');
    }),
  );

  // Auto-start
  const { autoStart } = getConfig();
  if (autoStart && getWorkspaceRoot()) {
    startServer().then((ok) => {
      if (ok) {
        startSDK();
        startPolling();
        updateStatusBar('running');
      }
    });
  }
}

export function deactivate(): void {
  stopPolling();
  killProcess(sdkProcess);
  sdkProcess = undefined;
  killProcess(serverProcess);
  serverProcess = undefined;
}
