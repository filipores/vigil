'use client';

import { useMemo } from 'react';
import type { FileChange, FunctionInfo } from '@agent-monitor/types';
import { FileTreeNode } from './FileTreeNode';

interface FileTreeProps {
  files: FileChange[];
  functions: FunctionInfo[];
  highlightedIds?: Set<string>;
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

export function FileTree({ files, functions, highlightedIds, onSelectFunction }: FileTreeProps) {
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
    <div className="p-3 pt-4">
      <div className="flex items-center gap-2 mb-4 px-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
          Files
        </span>
        {functions.length > 0 && (
          <span className="text-[10px] text-signal-dim font-mono">
            {functions.length}
          </span>
        )}
      </div>
      <div className="space-y-px">
        {Array.from(tree.children.values()).map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            functionsByFile={functionsByFile}
            highlightedIds={highlightedIds}
            onSelectFunction={onSelectFunction}
          />
        ))}
      </div>
      {functions.length === 0 && (
        <div className="px-2 py-8 text-center">
          <p className="text-[11px] text-text-dim leading-relaxed">
            Waiting for SDK connection...
          </p>
        </div>
      )}
    </div>
  );
}

export type { TreeNode };
