<script lang="ts">
  type Tab = 'files' | 'commits' | 'timeline';

  let { active, onChange, timelineBadge = 0 }: {
    active: Tab;
    onChange: (tab: Tab) => void;
    timelineBadge?: number;
  } = $props();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'files', label: 'Files' },
    { key: 'commits', label: 'Commits' },
    { key: 'timeline', label: 'Timeline' },
  ];
</script>

<div class="flex border-b border-border-subtle">
  {#each tabs as tab (tab.key)}
    <button
      class="text-[10px] font-medium uppercase tracking-[0.12em] px-3 py-2.5 transition-colors relative {active === tab.key
        ? 'text-text border-b-2 border-signal'
        : 'text-text-dim hover:text-text-secondary'}"
      onclick={() => onChange(tab.key)}
    >
      {tab.label}
      {#if tab.key === 'timeline' && timelineBadge > 0}
        <span class="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold px-1">
          {timelineBadge > 99 ? '99+' : timelineBadge}
        </span>
      {/if}
    </button>
  {/each}
</div>
