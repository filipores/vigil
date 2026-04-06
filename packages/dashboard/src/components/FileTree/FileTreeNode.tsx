'use client';

import { useState } from 'react';
import type { FunctionInfo } from '@agent-monitor/types';
import type { TreeNode } from './FileTree';

interface FileTreeNodeProps {
  node: TreeNode;
  functionsByFile: Map<string, FunctionInfo[]>;
  onSelectFunction: (id: string) => void;
  depth?: number;
}

export function FileTreeNode({
  node,
  functionsByFile,
  onSelectFunction,
  depth = 0,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.children.size > 0 && !node.file;
  const fileFunctions = node.file ? functionsByFile.get(node.file.filePath) ?? [] : [];

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <button
        className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-lg text-sm text-text-muted hover:bg-surface transition-all duration-200 ease-in-out"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs">{isDirectory ? (expanded ? '▼' : '▶') : '·'}</span>
        <span className="truncate">{node.name}</span>
        {fileFunctions.length > 0 && (
          <span className="ml-auto text-xs bg-surface-raised rounded px-1.5 py-0.5">
            {fileFunctions.length}
          </span>
        )}
      </button>

      {expanded && isDirectory && (
        <div>
          {Array.from(node.children.values()).map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              functionsByFile={functionsByFile}
              onSelectFunction={onSelectFunction}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {expanded && node.file && fileFunctions.length > 0 && (
        <div className="ml-6 space-y-0.5">
          {fileFunctions.map((fn) => (
            <button
              key={fn.id}
              className="block w-full text-left px-2 py-0.5 text-xs text-accent hover:bg-surface rounded transition-all duration-200 ease-in-out"
              onClick={() => onSelectFunction(fn.id)}
            >
              {fn.name}()
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
