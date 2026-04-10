<script lang="ts">
  import type { FunctionInfo } from '@agent-monitor/types';
  import { computeCommonRoot } from '../FileTree/computeCommonRoot';

  let {
    functions,
    isOpen,
    onClose,
    onSelect,
  }: {
    functions: FunctionInfo[];
    isOpen: boolean;
    onClose: () => void;
    onSelect: (functionId: string) => void;
  } = $props();

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement>(undefined!);
  let listEl = $state<HTMLDivElement>(undefined!);

  let commonRoot = $derived(computeCommonRoot(functions.map((f) => f.filePath)));

  function fuzzyMatch(q: string, target: string): number {
    const lowerTarget = target.toLowerCase();
    const lowerQuery = q.toLowerCase();
    if (lowerTarget.startsWith(lowerQuery)) return 3;
    if (lowerTarget.includes(lowerQuery)) return 2;
    let qi = 0;
    for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
      if (lowerTarget[ti] === lowerQuery[qi]) qi++;
    }
    if (qi === lowerQuery.length) return 1;
    return 0;
  }

  function scoreFn(q: string, fn: FunctionInfo): number {
    const nameScore = fuzzyMatch(q, fn.name);
    const pathScore = fuzzyMatch(q, fn.filePath);
    const catScore = fuzzyMatch(q, fn.category);
    return nameScore * 3 + pathScore * 2 + catScore;
  }

  let results = $derived.by(() => {
    if (!query.trim()) return functions.slice(0, 20);
    const scored: { fn: FunctionInfo; score: number }[] = [];
    for (const fn of functions) {
      const s = scoreFn(query, fn);
      if (s > 0) scored.push({ fn, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map((r) => r.fn);
  });

  $effect(() => {
    // Reset selection when results change
    results;
    selectedIndex = 0;
  });

  $effect(() => {
    if (isOpen) {
      query = '';
      selectedIndex = 0;
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  $effect(() => {
    if (!listEl) return;
    const selected = listEl.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  });

  function handleConfirm(index: number) {
    const fn = results[index];
    if (fn) {
      onSelect(fn.id);
      onClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        handleConfirm(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm"
      onclick={onClose}
    ></div>

    <!-- Palette -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="relative w-full max-w-lg bg-surface-raised border border-border-subtle rounded-xl shadow-2xl animate-fade-up"
      onkeydown={handleKeyDown}
    >
      <!-- Input -->
      <input
        bind:this={inputEl}
        type="text"
        bind:value={query}
        placeholder="Search functions and files..."
        class="w-full p-4 text-lg bg-surface text-text border-b border-border-subtle rounded-t-xl outline-none placeholder:text-text-dim"
      />

      <!-- Results -->
      <div bind:this={listEl} class="max-h-80 overflow-y-auto">
        {#if results.length === 0}
          <div class="px-4 py-6 text-center text-text-dim text-sm">
            No matching functions
          </div>
        {/if}
        {#each results as fn, i (fn.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            onclick={() => handleConfirm(i)}
            onmouseenter={() => selectedIndex = i}
            class="px-4 py-2 cursor-pointer flex items-center justify-between gap-3 {i === selectedIndex
              ? 'bg-surface border-l-2 border-signal'
              : 'hover:bg-surface border-l-2 border-transparent'}"
          >
            <div class="min-w-0 flex-1">
              <div class="text-text font-medium truncate">{fn.name}</div>
              <div class="text-text-secondary text-sm truncate">{commonRoot ? fn.filePath.replace(commonRoot, '') : fn.filePath}</div>
            </div>
            <span class="text-xs px-1.5 py-0.5 rounded bg-surface text-text-dim shrink-0">
              {fn.category}
            </span>
          </div>
        {/each}
      </div>

      <!-- Footer hint -->
      <div class="flex items-center gap-3 px-4 py-2 border-t border-border-subtle text-text-dim text-[11px]">
        <span><kbd class="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">&uarr;&darr;</kbd> navigate</span>
        <span><kbd class="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">enter</kbd> select</span>
        <span><kbd class="px-1 py-0.5 rounded bg-surface text-text-dim text-[10px]">esc</kbd> close</span>
      </div>
    </div>
  </div>
{/if}
