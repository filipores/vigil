'use client';

import { useState } from 'react';
import type { FunctionInfo } from '@agent-monitor/types';
import type { TreeNode } from './FileTree';

interface FileTreeNodeProps {
  node: TreeNode;
  functionsByFile: Map<string, FunctionInfo[]>;
  highlightedIds?: Set<string>;
  onSelectFunction: (id: string) => void;
  depth?: number;
}

export function FileTreeNode({
  node,
  functionsByFile,
  highlightedIds,
  onSelectFunction,
  depth = 0,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.children.size > 0 && !node.file;
  const fileFunctions = node.file ? functionsByFile.get(node.file.filePath) ?? [] : [];

  return (
    <div style={{ paddingLeft: depth * 10 }}>
      <button
        className="group flex items-center gap-1.5 w-full text-left px-2 py-[5px] rounded text-[12px] text-text-secondary hover:text-text hover:bg-surface-raised/50 transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[9px] text-text-dim w-3 text-center shrink-0">
          {isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="truncate font-mono text-[11px]">{node.name}</span>
        {fileFunctions.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-signal-dim opacity-60 group-hover:opacity-100 transition-opacity">
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
              highlightedIds={highlightedIds}
              onSelectFunction={onSelectFunction}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {expanded && node.file && fileFunctions.length > 0 && (
        <div className="ml-5 mt-0.5 mb-1 border-l border-border-subtle pl-2 space-y-px">
          {fileFunctions.map((fn) => {
            const isHighlighted = highlightedIds?.has(fn.id);
            return (
              <button
                key={fn.id}
                className={`group flex items-center gap-1.5 w-full text-left px-1.5 py-[3px] text-[11px] font-mono rounded transition-colors duration-150 ${
                  isHighlighted
                    ? 'text-warm hover:text-warm'
                    : 'text-signal-dim hover:text-signal'
                }`}
                onClick={() => onSelectFunction(fn.id)}
              >
                <span className={`w-1 h-1 rounded-full shrink-0 transition-colors ${
                  isHighlighted
                    ? 'bg-warm'
                    : 'bg-signal-dim group-hover:bg-signal'
                }`} />
                <span className="truncate">{fn.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
