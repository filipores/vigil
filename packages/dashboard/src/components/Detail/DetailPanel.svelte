<script lang="ts">
  import type { FunctionInfo, AgentContext, DataFlowEdge, AnalysisResult, AnalysisStatus, RuleViolation } from '@agent-monitor/types';
  import CodePreview from './CodePreview.svelte';
  import AnalysisSection from '../Analysis/AnalysisSection.svelte';
  import { computeCommonRoot } from '../FileTree/computeCommonRoot';

  let {
    fn,
    isOpen,
    onClose,
    onAskAgent,
    onOpenEditor,
    edges,
    allFunctions,
    onSelectFunction,
    analysisResults = [],
    activeAnalysisRun,
    analysisStreamingText = '',
    onTriggerAnalysis,
    onStopAnalysis,
    onDebugFunction,
    onDebugCallChain,
    violations = [],
    onFocusFunction,
  }: {
    fn: FunctionInfo | null;
    isOpen: boolean;
    onClose: () => void;
    onAskAgent: (ctx: AgentContext) => void;
    onOpenEditor: () => void;
    edges: DataFlowEdge[];
    allFunctions: FunctionInfo[];
    onSelectFunction: (id: string) => void;
    analysisResults?: AnalysisResult[];
    activeAnalysisRun?: AnalysisStatus;
    analysisStreamingText?: string;
    onTriggerAnalysis: (functionId: string, taskName?: string) => void;
    onStopAnalysis: (runId: string) => void;
    violations?: RuleViolation[];
    onDebugFunction?: (opts: { filePath: string; line: number; functionName: string }) => void;
    onDebugCallChain?: (chain: Array<{ filePath: string; line: number; name: string }>) => void;
    onFocusFunction?: (functionId: string) => void;
  } = $props();

  const VIOLATION_SEVERITY_DOT: Record<string, string> = {
    info: 'bg-text-secondary',
    warning: 'bg-warm',
    critical: 'bg-red-400',
  };

  const VIOLATION_SEVERITY_TEXT: Record<string, string> = {
    info: 'text-text-secondary',
    warning: 'text-warm',
    critical: 'text-red-400',
  };

  let debugButtonText = $state('Debug');
  let debugChainButtonText = $state('Debug Chain');

  function handleDebugClick() {
    if (!fn) return;
    try {
      onDebugFunction!({ filePath: fn.filePath, line: fn.line, functionName: fn.name });
      debugButtonText = 'Launched!';
      setTimeout(() => { debugButtonText = 'Debug'; }, 2000);
    } catch {
      debugButtonText = 'Error';
      setTimeout(() => { debugButtonText = 'Debug'; }, 2000);
    }
  }

  function handleDebugChainClick() {
    if (!fn) return;
    try {
      const chain = [
        ...callers.map((f) => ({ filePath: f.filePath, line: f.line, name: f.name })),
        { filePath: fn.filePath, line: fn.line, name: fn.name },
        ...callees.map((f) => ({ filePath: f.filePath, line: f.line, name: f.name })),
      ];
      onDebugCallChain!(chain);
      debugChainButtonText = 'Launched!';
      setTimeout(() => { debugChainButtonText = 'Debug Chain'; }, 2000);
    } catch {
      debugChainButtonText = 'Error';
      setTimeout(() => { debugChainButtonText = 'Debug Chain'; }, 2000);
    }
  }

  function handleAskAgent() {
    if (!fn) return;
    onAskAgent({
      snippet: fn.sourcePreview,
      file: fn.filePath,
      lineStart: fn.line,
      lineEnd: fn.line + fn.sourcePreview.split('\n').length - 1,
    });
  }

  let callers = $derived.by(() => {
    if (!fn) return [];
    return edges
      .filter((e) => e.targetId === fn.id)
      .map((e) => allFunctions.find((f) => f.id === e.sourceId))
      .filter((f): f is FunctionInfo => !!f);
  });

  let callees = $derived.by(() => {
    if (!fn) return [];
    return edges
      .filter((e) => e.sourceId === fn.id)
      .map((e) => allFunctions.find((f) => f.id === e.targetId))
      .filter((f): f is FunctionInfo => !!f);
  });

  let commonRoot = $derived(computeCommonRoot(allFunctions.map((f) => f.filePath)));

  function toRelative(absPath: string) {
    return commonRoot && absPath.startsWith(commonRoot)
      ? absPath.slice(commonRoot.length)
      : absPath;
  }
</script>

{#if isOpen && fn}
  <div class="w-96 border-l border-border-subtle bg-surface overflow-y-auto shrink-0 animate-slide-in">
    <div class="p-5 space-y-5">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-[14px] font-semibold text-text truncate font-mono">
            {fn.name}
          </h2>
          <button
            onclick={onOpenEditor}
            class="mt-1 text-[11px] text-text-dim hover:text-signal font-mono transition-colors duration-150 truncate block max-w-full"
            title="{fn.filePath}:{fn.line}"
          >
            {toRelative(fn.filePath)}:{fn.line}
          </button>
        </div>
        <button
          onclick={onClose}
          aria-label="Close"
          class="text-text-dim hover:text-text transition-colors p-1 -mr-1 -mt-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <!-- Quick actions -->
      <div class="flex gap-1.5">
        {#if onDebugFunction}
          <button
            onclick={handleDebugClick}
            class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all duration-150 {debugButtonText === 'Launched!'
              ? 'text-void bg-green-500'
              : debugButtonText === 'Error'
                ? 'text-void bg-red-400'
                : 'text-void bg-signal hover:brightness-110'}"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1" />
              <circle cx="5" cy="5" r="1" fill="currentColor" />
            </svg>
            {debugButtonText}
          </button>
        {/if}
        {#if onDebugCallChain}
          <button
            onclick={handleDebugChainClick}
            class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all duration-150 {debugChainButtonText === 'Launched!'
              ? 'text-void bg-green-500'
              : debugChainButtonText === 'Error'
                ? 'text-void bg-red-400'
                : 'text-text-secondary border border-border-subtle hover:bg-surface-raised/50 hover:text-text'}"
          >
            {debugChainButtonText}
          </button>
        {/if}
        {#if onFocusFunction}
          <button
            onclick={() => onFocusFunction!(fn!.id)}
            class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-secondary border border-border-subtle rounded hover:bg-surface-raised/50 hover:text-text transition-colors duration-150"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1" />
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
              <path d="M5 0v2M5 8v2M0 5h2M8 5h2" stroke="currentColor" stroke-width="0.8" />
            </svg>
            Focus
          </button>
        {/if}
      </div>

      <!-- Called by -->
      {#if callers.length > 0}
        <div>
          <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Called by
          </div>
          <div class="space-y-0.5">
            {#each callers as f (f.id)}
              <button
                onclick={() => onSelectFunction(f.id)}
                class="block text-[11px] font-mono text-text-secondary hover:text-signal transition-colors"
              >
                {f.name}{' '}
                <span class="text-text-dim text-[10px]">
                  {f.filePath.split('/').pop()}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Calls -->
      {#if callees.length > 0}
        <div>
          <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Calls
          </div>
          <div class="space-y-0.5">
            {#each callees as f (f.id)}
              <button
                onclick={() => onSelectFunction(f.id)}
                class="block text-[11px] font-mono text-text-secondary hover:text-signal transition-colors"
              >
                {f.name}{' '}
                <span class="text-text-dim text-[10px]">
                  {f.filePath.split('/').pop()}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Params -->
      {#if fn.params.length > 0}
        <div>
          <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Parameters
          </div>
          <div class="rounded-md overflow-hidden border border-border-subtle">
            {#each fn.params as p, i (p.name)}
              <div class="flex items-center justify-between px-3 py-1.5 text-[12px] font-mono {i % 2 === 0 ? 'bg-surface-raised/40' : ''}">
                <span class="text-text">{p.name}</span>
                <span class="text-signal-dim text-[11px]">{p.type}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Return type -->
      <div class="flex items-baseline gap-2">
        <span class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">
          Returns
        </span>
        <span class="text-[11px] font-mono text-warm-dim bg-surface-raised/60 rounded px-1.5 py-0.5">
          {fn.returnType}
        </span>
      </div>

      <!-- JSDoc -->
      {#if fn.jsdoc}
        <div>
          <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Documentation
          </div>
          <p class="text-[12px] leading-relaxed text-text-secondary italic">
            {fn.jsdoc}
          </p>
        </div>
      {/if}

      <!-- Source preview -->
      <div>
        <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
          Source
        </div>
        <CodePreview code={fn.sourcePreview} startLine={fn.line} />
      </div>

      <!-- Rule Violations -->
      {#if violations && violations.length > 0}
        <div>
          <div class="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim mb-2">
            Rule Violations
          </div>
          <div class="space-y-1.5">
            {#each violations as v}
              <div class="flex items-start gap-1.5 px-2 py-1.5 rounded border {v.severity === 'critical' ? 'border-red-400/30 bg-red-400/5' : 'border-border-subtle bg-surface-raised/30'}">
                <span class="mt-1 w-1.5 h-1.5 rounded-full shrink-0 {VIOLATION_SEVERITY_DOT[v.severity]}"></span>
                <div class="min-w-0">
                  <span class="text-[11px] font-medium {VIOLATION_SEVERITY_TEXT[v.severity]}">
                    {v.rule}
                  </span>
                  <p class="text-[10px] text-text-dim leading-snug mt-0.5">
                    {v.description}
                  </p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Analysis -->
      <AnalysisSection
        analysisResults={analysisResults}
        activeRun={activeAnalysisRun}
        streamingText={analysisStreamingText}
        onTrigger={(taskName) => onTriggerAnalysis(fn!.id, taskName)}
        onStop={onStopAnalysis}
      />

      <!-- Actions -->
      <div class="flex gap-2 pt-1">
        <button
          onclick={onOpenEditor}
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-text-secondary border border-border-subtle rounded-md hover:bg-surface-raised/50 hover:text-text transition-colors duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 10l2.5-1L9 4.5 7.5 3 3 7.5 2 10z" stroke="currentColor" stroke-width="1" />
            <path d="M6.5 3.5l2 2" stroke="currentColor" stroke-width="1" />
          </svg>
          Editor
        </button>
        <button
          onclick={handleAskAgent}
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-void bg-signal rounded-md hover:brightness-110 transition-all duration-150"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1" />
            <circle cx="6" cy="6" r="1.5" fill="currentColor" />
          </svg>
          Ask Agent
        </button>
      </div>
    </div>
  </div>
{/if}
