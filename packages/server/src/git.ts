import { spawn } from 'node:child_process';
import type { GitCommit, CommitDiff, DiffLine, FileDiff } from '@agent-monitor/types';

function run(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exited with ${code}`));
    });
    proc.on('error', reject);
  });
}

export async function getCommits(root: string, limit: number): Promise<GitCommit[]> {
  const raw = await run(
    ['log', '--format=%H|%h|%s|%an|%aI', '--name-only', '-n', String(limit)],
    root,
  );

  const commits: GitCommit[] = [];
  const blocks = raw.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    const header = lines[0];
    const parts = header.split('|');
    if (parts.length < 5) continue;

    const [fullHash, hash, message, author, date] = [
      parts[0],
      parts[1],
      parts.slice(2, -2).join('|'),
      parts[parts.length - 2],
      parts[parts.length - 1],
    ];

    // The message may contain pipes, so we need to handle that:
    // format is: fullHash|hash|message|author|date
    // author and date never contain pipes, so split from the end
    const filesChanged = lines.slice(1).filter((l) => l.trim().length > 0);

    commits.push({ fullHash, hash, message, author, date, filesChanged });
  }

  return commits;
}

export async function getCommitDiff(root: string, hash: string): Promise<CommitDiff> {
  const raw = await run(['show', '--unified=3', hash], root);
  const lines = raw.split('\n');
  const diffs: FileDiff[] = [];
  let currentFile: FileDiff | null = null;
  let oldLineNo = 0;
  let newLineNo = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = line.match(/b\/(.+)$/);
      currentFile = { filePath: match ? match[1] : '', lines: [] };
      diffs.push(currentFile);
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('Binary files')) continue;
    if (line.startsWith('---') || line.startsWith('+++')) continue;

    if (line.startsWith('@@')) {
      const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        oldLineNo = parseInt(hunkMatch[1], 10);
        newLineNo = parseInt(hunkMatch[2], 10);
      }
      const diffLine: DiffLine = {
        type: 'header',
        content: line,
        oldLineNo: null,
        newLineNo: null,
      };
      currentFile.lines.push(diffLine);
      continue;
    }

    if (line.startsWith('+')) {
      const diffLine: DiffLine = {
        type: 'added',
        content: line.slice(1),
        oldLineNo: null,
        newLineNo: newLineNo++,
      };
      currentFile.lines.push(diffLine);
    } else if (line.startsWith('-')) {
      const diffLine: DiffLine = {
        type: 'removed',
        content: line.slice(1),
        oldLineNo: oldLineNo++,
        newLineNo: null,
      };
      currentFile.lines.push(diffLine);
    } else if (line.startsWith(' ')) {
      const diffLine: DiffLine = {
        type: 'context',
        content: line.slice(1),
        oldLineNo: oldLineNo++,
        newLineNo: newLineNo++,
      };
      currentFile.lines.push(diffLine);
    }
  }

  return { hash, diffs };
}
