<script lang="ts">
  import type { FunctionInfo } from '@agent-monitor/types';
  import type { TreeNode } from './FileTree.svelte';
  import FileTreeNode from './FileTreeNode.svelte';

  let {
    node,
    functionsByFile,
    highlightedIds,
    onSelectFunction,
    depth = 0,
  }: {
    node: TreeNode;
    functionsByFile: Map<string, FunctionInfo[]>;
    highlightedIds?: Set<string>;
    onSelectFunction: (id: string) => void;
    depth?: number;
  } = $props();

  let expanded = $state(false);
  let isDirectory = $derived(node.children.size > 0 && !node.file);
  let fileFunctions = $derived(node.file ? functionsByFile.get(node.file.filePath) ?? [] : []);
</script>

<div style:padding-left="{depth * 10}px">
  <button
    class="group flex items-center gap-1.5 w-full text-left px-2 py-[5px] rounded text-[12px] text-text-secondary hover:text-text hover:bg-surface-raised/50 transition-colors duration-150"
    onclick={() => expanded = !expanded}
  >
    <span class="text-[9px] text-text-dim w-3 text-center shrink-0">
      {isDirectory ? (expanded ? '\u25BE' : '\u25B8') : ''}
    </span>
    <span class="truncate font-mono text-[11px]">{node.name}</span>
    {#if fileFunctions.length > 0}
      <span class="ml-auto font-mono text-[10px] text-signal-dim opacity-60 group-hover:opacity-100 transition-opacity">
        {fileFunctions.length}
      </span>
    {/if}
  </button>

  {#if expanded && isDirectory}
    <div>
      {#each Array.from(node.children.values()) as child (child.path)}
        <FileTreeNode
          node={child}
          {functionsByFile}
          {highlightedIds}
          {onSelectFunction}
          depth={depth + 1}
        />
      {/each}
    </div>
  {/if}

  {#if expanded && node.file && fileFunctions.length > 0}
    <div class="ml-5 mt-0.5 mb-1 border-l border-border-subtle pl-2 space-y-px">
      {#each fileFunctions as fn (fn.id)}
        {@const isHighlighted = highlightedIds?.has(fn.id)}
        <button
          class="group flex items-center gap-1.5 w-full text-left px-1.5 py-[3px] text-[11px] font-mono rounded transition-colors duration-150 {isHighlighted
            ? 'text-warm hover:text-warm'
            : 'text-signal-dim hover:text-signal'}"
          onclick={() => onSelectFunction(fn.id)}
        >
          <span class="w-1 h-1 rounded-full shrink-0 transition-colors {isHighlighted
            ? 'bg-warm'
            : 'bg-signal-dim group-hover:bg-signal'}"></span>
          <span class="truncate">{fn.name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>
