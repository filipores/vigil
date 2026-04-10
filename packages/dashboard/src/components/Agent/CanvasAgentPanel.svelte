<script lang="ts">
  import type { FunctionInfo, DataFlowEdge, CanvasLayout, CanvasCommand } from '@agent-monitor/types';
  import { runCanvasAgent } from '$lib/api';

  let {
    isOpen,
    onClose,
    onCommand,
    functions,
    edges,
    layout,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onCommand: (cmd: CanvasCommand) => void;
    functions: FunctionInfo[];
    edges: DataFlowEdge[];
    layout: CanvasLayout;
  } = $props();

  interface CommandEntry {
    id: number;
    cmd: CanvasCommand;
  }

  let prompt = $state('');
  let commands = $state<CommandEntry[]>([]);
  let running = $state(false);
  let error = $state<string | null>(null);
  let counter = 0;

  async function handleRun() {
    if (!prompt.trim() || running) return;
    running = true;
    commands = [];
    error = null;

    try {
      const stream = await runCanvasAgent(prompt, { functions, edges, canvasLayout: layout });
      if (!stream) { running = false; return; }

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed.type === 'string') {
              const id = ++counter;
              commands = [...commands, { id, cmd: parsed as CanvasCommand }];
              onCommand(parsed as CanvasCommand);
            }
          } catch {
            // not JSON, skip
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      running = false;
    }
  }
</script>

{#if isOpen}
  <div class="w-72 border-l border-border-subtle bg-surface h-full overflow-y-auto shrink-0 flex flex-col">
    <div class="p-4 space-y-3">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-medium uppercase tracking-[0.1em] text-text-dim">
          Agent Harness
        </span>
        <button
          onclick={onClose}
          aria-label="Close"
          class="text-text-dim hover:text-text transition-colors p-1 -mr-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- Prompt -->
      <textarea
        bind:value={prompt}
        rows="2"
        placeholder="Describe layout changes..."
        class="w-full text-[11px] font-mono bg-void border border-border-subtle rounded px-2 py-1.5 text-text placeholder:text-text-dim/50 resize-none focus:outline-none focus:border-signal/40"
      ></textarea>

      <!-- Run -->
      <button
        onclick={handleRun}
        disabled={running || !prompt.trim()}
        class="w-full px-3 py-1.5 text-[11px] font-medium bg-signal text-void rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {running ? 'Running...' : 'Run'}
      </button>

      <!-- Error -->
      {#if error}
        <div class="text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1.5">
          {error}
        </div>
      {/if}

      <!-- Commands -->
      {#if commands.length > 0}
        <div class="space-y-1.5">
          <span class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
            Commands
          </span>
          {#each commands as entry (entry.id)}
            <div class="text-[10px] font-mono bg-void/50 border border-border-subtle rounded px-2 py-1 text-signal-dim">
              {entry.cmd.type}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
