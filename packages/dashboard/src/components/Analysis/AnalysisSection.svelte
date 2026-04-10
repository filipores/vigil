<script lang="ts">
  import { onMount } from 'svelte';
  import type { AnalysisResult, AnalysisStatus } from '@agent-monitor/types';
  import { getAutoAnalysis, setAutoAnalysis } from '$lib/api';

  const TASK_OPTIONS = [
    { value: 'function-review', label: 'Code Review' },
    { value: 'change-summary', label: 'Change Summary' },
    { value: 'data-flow-trace', label: 'Data Flow Trace' },
    { value: 'drift-detection', label: 'Drift Detection' },
  ] as const;

  let {
    analysisResults,
    activeRun,
    streamingText = '',
    onTrigger,
    onStop,
  }: {
    analysisResults: AnalysisResult[];
    activeRun: AnalysisStatus | undefined;
    streamingText?: string;
    onTrigger: (taskName?: string) => void;
    onStop: (runId: string) => void;
  } = $props();

  let selectedTask = $state('function-review');
  let autoEnabled = $state(false);
  let sorted = $derived([...analysisResults].sort((a, b) => b.timestamp - a.timestamp));

  let streamingContainer: HTMLPreElement | undefined = $state();

  // Auto-scroll streaming output to bottom
  $effect(() => {
    if (streamingText && streamingContainer) {
      streamingContainer.scrollTop = streamingContainer.scrollHeight;
    }
  });

  onMount(() => {
    getAutoAnalysis()
      .then((res) => { autoEnabled = res.enabled; })
      .catch(() => { /* ignore */ });
  });

  async function toggleAuto() {
    const next = !autoEnabled;
    autoEnabled = next;
    try {
      await setAutoAnalysis(next);
    } catch {
      autoEnabled = !next;
    }
  }

  const SEVERITY_CLASS: Record<string, string> = {
    info: 'text-text-secondary',
    warning: 'text-warm',
    critical: 'text-red-400',
  };

  const SEVERITY_DOT: Record<string, string> = {
    info: 'bg-text-secondary',
    warning: 'bg-warm',
    critical: 'bg-red-400',
  };

  const TASK_BADGE_CLASS: Record<string, string> = {
    'function-review': 'bg-signal/10 text-signal',
    'change-summary': 'bg-warm/10 text-warm',
    'data-flow-trace': 'bg-purple-500/10 text-purple-400',
    'drift-detection': 'bg-red-500/10 text-red-400',
  };

  function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function taskLabel(taskName: string): string {
    const found = TASK_OPTIONS.find((o) => o.value === taskName);
    return found ? found.label : taskName;
  }
</script>

<div>
  <!-- Header -->
  <div class="flex items-center justify-between mb-2">
    <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
      Integration Analysis
    </div>
    <div class="flex items-center gap-1.5">
      {#if activeRun && (activeRun.status === 'running' || activeRun.status === 'queued')}
        <button
          disabled
          class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-signal/70 bg-signal/10 border border-signal/20 rounded cursor-not-allowed"
        >
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" style="animation: signal-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal"></span>
          </span>
          Analyzing...
        </button>
        <button
          onclick={() => onStop(activeRun!.runId)}
          class="px-2 py-1 text-[10px] font-medium text-warm border border-warm/30 rounded hover:bg-warm/10 transition-colors duration-150"
        >
          Stop
        </button>
      {:else}
        <div class="flex flex-col gap-0.5">
          <label for="analysis-task" class="text-[10px] text-text-secondary">Task</label>
          <select
            id="analysis-task"
            bind:value={selectedTask}
            class="bg-surface text-text border border-border-subtle rounded-md text-sm px-2 py-1 outline-none focus:border-signal/40 transition-colors"
          >
            {#each TASK_OPTIONS as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <!-- Auto toggle -->
        <button
          onclick={toggleAuto}
          class="flex items-center gap-1 px-1.5 py-1 text-[10px] font-medium rounded border transition-colors duration-150 self-end {autoEnabled
            ? 'text-signal border-signal/30 bg-signal/10'
            : 'text-text-dim border-border-subtle hover:text-text'}"
          title={autoEnabled ? 'Auto-analysis enabled' : 'Auto-analysis disabled'}
        >
          <span
            class="inline-block w-5 h-3 rounded-full relative transition-colors duration-150 {autoEnabled ? 'bg-signal/30' : 'bg-surface-bright'}"
          >
            <span
              class="absolute top-0.5 w-2 h-2 rounded-full transition-all duration-150 {autoEnabled ? 'left-2.5 bg-signal' : 'left-0.5 bg-text-dim'}"
            ></span>
          </span>
          Auto
        </button>
        <button
          onclick={() => onTrigger(selectedTask)}
          class="px-2 py-1 text-[10px] font-medium text-void bg-signal rounded hover:brightness-110 transition-all duration-150 self-end"
        >
          Run Analysis
        </button>
      {/if}
    </div>
  </div>

  <!-- Active run status -->
  {#if activeRun}
    <div class="flex items-center gap-2 px-3 py-2 mb-3 rounded-md border border-signal/20 bg-signal/5">
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping"></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-signal"></span>
      </span>
      <span class="text-[11px] text-signal">
        {activeRun.status === 'queued' ? 'Queued' : 'Running'}
      </span>
    </div>

    <!-- Streaming output -->
    {#if streamingText}
      <pre
        bind:this={streamingContainer}
        class="font-mono text-sm text-text-secondary bg-surface border border-border-subtle rounded px-3 py-2 mb-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words"
      >{streamingText}</pre>
    {/if}
  {/if}

  <!-- Results -->
  {#if sorted.length === 0 && !activeRun}
    <p class="text-[11px] text-text-dim italic">No analysis results yet.</p>
  {/if}

  {#each sorted as result, idx (result.id)}
    <div class="{idx > 0 ? 'mt-3 pt-3 border-t border-border-subtle' : ''}">
      <!-- Timestamp + task badge -->
      <div class="flex items-center gap-2 mb-1.5">
        <span class="text-[10px] text-text-dim tabular-nums">{formatTimestamp(result.timestamp)}</span>
        <span class="text-[9px] font-medium px-1.5 py-0.5 rounded-full {TASK_BADGE_CLASS[result.taskName] ?? 'bg-surface-raised text-text-secondary'}">
          {taskLabel(result.taskName)}
        </span>
      </div>

      <!-- Summary -->
      <p class="text-[12px] leading-relaxed text-text-secondary mb-2">
        {result.summary}
      </p>

      <!-- Concerns -->
      {#if result.concerns.length > 0}
        <div class="space-y-1 mb-2">
          {#each result.concerns as c, ci}
            <div class="flex items-start gap-1.5">
              <span class="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 {SEVERITY_DOT[c.severity] ?? SEVERITY_DOT.info}"></span>
              <span class="text-[11px] leading-snug {SEVERITY_CLASS[c.severity] ?? SEVERITY_CLASS.info}">
                {c.description}
                {#if c.line != null}
                  <span class="text-text-dim ml-1 text-[10px]">L{c.line}</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Integration notes -->
      {#if result.integrationNotes.length > 0}
        <div class="space-y-0.5">
          {#each result.integrationNotes as note, ni}
            <p class="text-[11px] text-text-dim leading-snug pl-2 border-l border-border-subtle">
              {note}
            </p>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>
