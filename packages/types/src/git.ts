export interface GitCommit {
  hash: string;
  fullHash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export type DiffLineType = 'added' | 'removed' | 'context' | 'header';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNo: number | null;
  newLineNo: number | null;
}

export interface FileDiff {
  filePath: string;
  lines: DiffLine[];
}

export interface CommitDiff {
  hash: string;
  diffs: FileDiff[];
}
