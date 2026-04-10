<script lang="ts">
  import type { ScopeMode } from '$lib/stores/graphScope.svelte';
  import type { FunctionInfo } from '@agent-monitor/types';

  let {
    scopeMode,
    totalCount,
    scopedCount,
    clearScope,
    functions,
    commitHash,
  }: {
    scopeMode: ScopeMode;
    totalCount: number;
    scopedCount: number;
    clearScope: () => void;
    functions: FunctionInfo[];
    commitHash?: string | null;
  } = $props();
</script>

{#if scopeMode.type === 'all'}
  {#if totalCount > 300}
    <div class="flex items-center gap-2 h-7 px-4 bg-surface-raised/50 border-b border-border-subtle shrink-0">
      <span class="text-[11px] text-text-dim">
        Showing all {totalCount} functions
      </span>
    </div>
  {/if}
{:else}
  {@const labelDetail = (() => {
    switch (scopeMode.type) {
      case 'focus': {
        const fn = functions.find((f) => f.id === scopeMode.functionId);
        const name = fn?.name ?? 'unknown';
        return { label: 'Focus', detail: `${name} (${scopeMode.hops}-hop neighborhood) — ${scopedCount} functions` };
      }
      case 'commit': {
        const shortHash = commitHash ? commitHash.slice(0, 7) : '???';
        return { label: 'Commit', detail: `${shortHash} — ${scopedCount} functions changed` };
      }
      case 'category': {
        const names = Array.from(scopeMode.categories).join(', ');
        return { label: 'Filter', detail: `${names} — ${scopedCount} functions` };
      }
    }
  })()}

  <div class="flex items-center gap-2 h-7 px-4 bg-surface-raised/50 border-b border-border-subtle shrink-0">
    <span class="text-[11px] font-medium text-signal">{labelDetail.label}</span>
    <span class="text-[11px] text-text-secondary">{labelDetail.detail}</span>
    <button
      onclick={clearScope}
      class="ml-auto flex items-center gap-1 text-[10px] text-text-dim hover:text-text transition-colors"
    >
      Clear
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M3 3l4 4M7 3l-4 4"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>
{/if}
