<script lang="ts">
  import type { FunctionInfo, FunctionCategory } from '@agent-monitor/types';

  let {
    functions,
    selectedCategory,
    onSelectCategory,
  }: {
    functions: FunctionInfo[];
    selectedCategory: FunctionCategory | null;
    onSelectCategory: (category: FunctionCategory | null) => void;
  } = $props();

  let categoryCounts = $derived.by(() => {
    const counts = new Map<FunctionCategory, number>();
    for (const fn of functions) {
      counts.set(fn.category, (counts.get(fn.category) ?? 0) + 1);
    }
    return counts;
  });

  let categories = $derived(Array.from(categoryCounts.entries()));
</script>

{#if categories.length > 0}
  <div class="flex flex-wrap gap-1 px-3 py-2 border-b border-border-subtle">
    <button
      class="text-[10px] font-mono px-2 py-0.5 rounded {selectedCategory === null
        ? 'bg-signal/10 text-signal'
        : 'text-text-dim hover:bg-surface-raised/50'}"
      onclick={() => onSelectCategory(null)}
    >
      all
    </button>
    {#each categories as [category, count] (category)}
      <button
        class="text-[10px] font-mono px-2 py-0.5 rounded {selectedCategory === category
          ? 'bg-signal/10 text-signal'
          : 'text-text-dim hover:bg-surface-raised/50'}"
        onclick={() => onSelectCategory(category)}
      >
        {category} {count}
      </button>
    {/each}
  </div>
{/if}
