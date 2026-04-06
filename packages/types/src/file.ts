export type FileChangeType = 'added' | 'modified' | 'deleted';

export interface FileChange {
  filePath: string;
  type: FileChangeType;
  timestamp: number;
  functions: string[];
}
