<script lang="ts">
  let { code, startLine = 1 }: { code: string; startLine?: number } = $props();
  let lines = $derived(code.split('\n'));
</script>

<pre class="bg-void rounded-md p-3 overflow-x-auto text-[11px] leading-[1.6] border border-border-subtle">
  <code>
    {#each lines as line, i}
      <div class="flex hover:bg-surface-raised/30 -mx-1 px-1 rounded-sm transition-colors">
        <span class="font-mono text-text-dim select-none w-7 text-right mr-3 shrink-0 tabular-nums">
          {startLine + i}
        </span>
        <span class="font-mono text-text-secondary">{line || ' '}</span>
      </div>
    {/each}
  </code>
</pre>
