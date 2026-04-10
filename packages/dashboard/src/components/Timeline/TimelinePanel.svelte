<script lang="ts">
  import type { TimelineEvent } from '@agent-monitor/types';
  import type { TimelineFilter } from '$lib/stores/timeline.svelte';

  let {
    events,
    onSelectFunction,
    filterEvents,
  }: {
    events: TimelineEvent[];
    onSelectFunction: (id: string) => void;
    filterEvents: (items: TimelineEvent[], filter: TimelineFilter) => TimelineEvent[];
  } = $props();

  let activeFilter = $state<TimelineFilter>('all');

  let filtered = $derived(filterEvents(events, activeFilter));

  const filters: { key: TimelineFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'changes', label: 'Changes' },
    { key: 'analysis', label: 'Analysis' },
    { key: 'violations', label: 'Violations' },
  ];

  const iconMap: Record<TimelineEvent['type'], string> = {
    'function-added': '+',
    'function-updated': '↻',
    'function-removed': '✗',
    'analysis-completed': '◉',
    'rule-violation': '⚠',
    'commit': '●',
  };

  function relativeTime(ts: number): string {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  }

  function severityColor(severity?: 'info' | 'warning' | 'critical'): string {
    if (severity === 'critical') return 'bg-red-500';
    if (severity === 'warning') return 'bg-warm';
    if (severity === 'info') return 'bg-text-secondary';
    return '';
  }

  function handleClick(event: TimelineEvent) {
    if (event.functionId) {
      onSelectFunction(event.functionId);
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Filter buttons -->
  <div class="flex gap-1 px-3 py-2 border-b border-border-subtle">
    {#each filters as f (f.key)}
      <button
        class="text-[10px] px-2 py-1 rounded transition-colors {activeFilter === f.key
          ? 'bg-surface-raised text-text'
          : 'text-text-dim hover:text-text-secondary'}"
        onclick={() => activeFilter = f.key}
      >
        {f.label}
      </button>
    {/each}
  </div>

  <!-- Event list -->
  <div class="flex-1 overflow-y-auto">
    {#if filtered.length === 0}
      <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="text-text-dim mb-3">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
          <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <p class="text-[12px] text-text-secondary font-medium mb-1">No events yet</p>
        <p class="text-[11px] text-text-dim leading-relaxed max-w-[200px]">Changes, analyses, and violations will appear here as they happen</p>
      </div>
    {:else}
      {#each filtered as event (event.id)}
        <button
          class="w-full text-left px-3 py-2 border-b border-border-subtle hover:bg-surface cursor-pointer transition-colors flex items-start gap-2"
          onclick={() => handleClick(event)}
        >
          <!-- Icon -->
          <span class="text-text-dim text-xs w-4 shrink-0 pt-0.5 text-center font-mono">
            {iconMap[event.type]}
          </span>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              {#if event.severity}
                <span class="w-1.5 h-1.5 rounded-full shrink-0 {severityColor(event.severity)}"></span>
              {/if}
              <span class="text-text text-sm truncate">{event.summary}</span>
            </div>
            <div class="text-text-dim text-xs mt-0.5">{relativeTime(event.timestamp)}</div>
          </div>
        </button>
      {/each}
    {/if}
  </div>
</div>
