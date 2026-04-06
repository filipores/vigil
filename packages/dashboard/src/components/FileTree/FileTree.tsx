'use client';

import { useMemo } from 'react';
import type { FileChange, FunctionInfo } from '@agent-monitor/types';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeProps {
  files: FileChange[];
  functions: FunctionInfo[];
  onSelectFunction: (id: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  file: FileChange | null;
}

function buildTree(files: FileChange[]): TreeNode {
  const root: TreeNode = { name: '', path: '', children: new Map(), file: null };

  for (const file of files) {
    const parts = file.filePath.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          children: new Map(),
          file: null,
        });
      }
      current = current.children.get(part)!;
    }

    current.file = file;
  }

  return root;
}

export function FileTree({ files, functions, onSelectFunction }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  const functionsByFile = useMemo(() => {
    const map = new Map<string, FunctionInfo[]>();
    for (const fn of functions) {
      const existing = map.get(fn.filePath) ?? [];
      existing.push(fn);
      map.set(fn.filePath, existing);
    }
    return map;
  }, [functions]);

  return (
    <div className="p-4">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Files
      </h2>
      <div className="space-y-0.5">
        {Array.from(tree.children.values()).map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            functionsByFile={functionsByFile}
            onSelectFunction={onSelectFunction}
          />
        ))}
      </div>
    </div>
  );
}

export type { TreeNode };
