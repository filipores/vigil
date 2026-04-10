<script lang="ts">
  type Tab = 'files' | 'commits';

  let { active, onChange }: { active: Tab; onChange: (tab: Tab) => void } = $props();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'files', label: 'Files' },
    { key: 'commits', label: 'Commits' },
  ];
</script>

<div class="flex border-b border-border-subtle">
  {#each tabs as tab (tab.key)}
    <button
      class="text-[10px] font-medium uppercase tracking-[0.12em] px-3 py-2.5 transition-colors {active === tab.key
        ? 'text-text border-b-2 border-signal'
        : 'text-text-dim hover:text-text-secondary'}"
      onclick={() => onChange(tab.key)}
    >
      {tab.label}
    </button>
  {/each}
</div>
