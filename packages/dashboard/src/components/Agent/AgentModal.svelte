<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AgentContext } from '@agent-monitor/types';
  import CodePreview from '../Detail/CodePreview.svelte';
  import AgentForm from './AgentForm.svelte';
  import { runAgent } from '$lib/api';

  let {
    isOpen,
    onClose,
    context,
  }: {
    isOpen: boolean;
    onClose: () => void;
    context: AgentContext;
  } = $props();

  let response = $state('');
  let isLoading = $state(false);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  async function handleSubmit(prompt: string) {
    isLoading = true;
    response = '';

    try {
      const stream = await runAgent({ prompt, context });
      if (!stream) return;

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        response += decoder.decode(value, { stream: true });
      }
    } catch {
      response = 'Error: Failed to run agent.';
    } finally {
      isLoading = false;
    }
  }

  let shortPath = $derived(context.file.split('/').slice(-3).join('/'));
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div class="max-w-2xl w-full mx-4 bg-surface rounded-lg border border-border-subtle shadow-2xl shadow-black/40 animate-fade-up">
      <div class="p-5 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="text-signal">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
              <circle cx="7" cy="7" r="2" fill="currentColor" />
            </svg>
            <h2 class="text-[14px] font-semibold text-text">Ask Agent</h2>
          </div>
          <button
            onclick={onClose}
            aria-label="Close"
            class="text-text-dim hover:text-text transition-colors p-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- Context -->
        <div class="space-y-2">
          <div class="text-[11px] font-mono text-text-dim">
            {shortPath} <span class="text-text-dim/50">:</span> {context.lineStart}-{context.lineEnd}
          </div>
          <CodePreview code={context.snippet} startLine={context.lineStart} />
        </div>

        <!-- Form -->
        <AgentForm onSubmit={handleSubmit} {isLoading} />

        <!-- Response -->
        {#if response}
          <div>
            <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
              Response
            </div>
            <pre class="bg-void rounded-md border border-border-subtle p-3 text-[11px] font-mono text-text-secondary overflow-auto max-h-64 whitespace-pre-wrap leading-relaxed">{response}</pre>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
