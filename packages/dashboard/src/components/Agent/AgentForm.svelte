<script lang="ts">
  let { onSubmit, isLoading }: { onSubmit: (prompt: string) => void; isLoading: boolean } = $props();

  let prompt = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSubmit(prompt.trim());
  }
</script>

<form onsubmit={handleSubmit} class="space-y-3">
  <textarea
    bind:value={prompt}
    placeholder="What should the agent do with this code?"
    rows="2"
    class="w-full resize-y border border-border-subtle rounded-md p-3 text-[12px] font-mono bg-void text-text placeholder:text-text-dim focus:outline-none focus:border-signal-dim/50 transition-colors duration-150"
  ></textarea>
  <div class="flex items-center justify-between">
    <span class="text-[10px] text-text-dim">
      {isLoading ? 'Agent is working...' : 'Press enter or click to run'}
    </span>
    <button
      type="submit"
      disabled={isLoading || !prompt.trim()}
      class="px-4 py-1.5 text-[12px] font-medium text-void bg-signal rounded-md hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
    >
      {#if isLoading}
        <span class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-void animate-pulse"></span>
          Running
        </span>
      {:else}
        Run
      {/if}
    </button>
  </div>
</form>
