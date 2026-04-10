<script lang="ts" module>
  import type { FileChange } from '@agent-monitor/types';

  export interface TreeNode {
    name: string;
    path: string;
    children: Map<string, TreeNode>;
    file: FileChange | null;
  }
</script>

<script lang="ts">
  import type { FunctionInfo } from '@agent-monitor/types';
  import FileTreeNode from './FileTreeNode.svelte';
  import { computeCommonRoot } from './computeCommonRoot';

  let {
    files,
    functions,
    highlightedIds,
    onSelectFunction,
  }: {
    files: FileChange[];
    functions: FunctionInfo[];
    highlightedIds?: Set<string>;
    onSelectFunction: (id: string) => void;
  } = $props();

  function buildTree(files: FileChange[], commonRoot: string): TreeNode {
    const root: TreeNode = { name: '', path: '', children: new Map(), file: null };

    for (const file of files) {
      const relativePath = file.filePath.startsWith(commonRoot)
        ? file.filePath.slice(commonRoot.length)
        : file.filePath;
      const parts = relativePath.split('/').filter(Boolean);
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

  let commonRoot = $derived(computeCommonRoot(files.map((f) => f.filePath)));
  let tree = $derived(buildTree(files, commonRoot));

  let functionsByFile = $derived.by(() => {
    const map = new Map<string, FunctionInfo[]>();
    for (const fn of functions) {
      const existing = map.get(fn.filePath) ?? [];
      existing.push(fn);
      map.set(fn.filePath, existing);
    }
    return map;
  });
</script>

<div class="p-3 pt-4">
  <div class="flex items-center gap-2 mb-4 px-2">
    <span class="text-[10px] font-medium uppercase tracking-[0.12em] text-text-dim">
      Files
    </span>
    {#if functions.length > 0}
      <span class="text-[10px] text-signal-dim font-mono">
        {functions.length}
      </span>
    {/if}
  </div>
  <div class="space-y-px">
    {#each Array.from(tree.children.values()) as node (node.path)}
      <FileTreeNode
        {node}
        {functionsByFile}
        {highlightedIds}
        {onSelectFunction}
      />
    {/each}
  </div>
  {#if functions.length === 0}
    <div class="px-2 py-8 text-center">
      <p class="text-[11px] text-text-dim leading-relaxed">
        Waiting for SDK connection...
      </p>
    </div>
  {/if}
</div>
