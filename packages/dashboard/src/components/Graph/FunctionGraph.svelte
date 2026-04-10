<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { FunctionInfo, DataFlowEdge, CanvasLayout, AnalysisResult, RuleViolation } from '@agent-monitor/types';
  import { createForceGraph, type ForceGraphUpdateData } from './forceGraph';

  let {
    functions,
    edges,
    canvasLayout,
    selectedId,
    highlightedIds,
    onSelectFunction,
    onPinNode,
    canvasMode = false,
    analysisMap,
    violationsMap,
  }: {
    functions: FunctionInfo[];
    edges: DataFlowEdge[];
    canvasLayout: CanvasLayout;
    selectedId: string | null;
    highlightedIds?: Set<string>;
    onSelectFunction: (id: string) => void;
    onPinNode?: (id: string, x: number, y: number) => void;
    canvasMode?: boolean;
    analysisMap?: Map<string, AnalysisResult[]>;
    violationsMap?: Map<string, RuleViolation[]>;
  } = $props();

  const GRAPH_HARD_CAP = 2000;

  let containerEl: HTMLDivElement;
  let canvasEl: HTMLCanvasElement;
  let graph: ReturnType<typeof createForceGraph> | null = null;
  let resizeObserver: ResizeObserver | null = null;

  let tooManyNodes = $derived(functions.length > GRAPH_HARD_CAP);

  function resizeCanvas() {
    if (!containerEl || !canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = containerEl.getBoundingClientRect();
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    canvasEl.style.width = `${rect.width}px`;
    canvasEl.style.height = `${rect.height}px`;
    const ctx = canvasEl.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }

  onMount(() => {
    resizeCanvas();
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(containerEl);

    if (!tooManyNodes) {
      graph = createForceGraph({
        canvas: canvasEl,
        onNodeClick: onSelectFunction,
        canvasMode,
        onNodeDrag: onPinNode,
      });

      graph.update({
        nodes: functions,
        edges,
        canvasLayout,
        selectedId,
        highlightedIds,
        analysisMap,
        violationsMap,
      });
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    graph?.destroy();
  });

  function handleResetZoom() {
    graph?.resetZoom();
  }

  $effect(() => {
    if (tooManyNodes) {
      // Destroy existing graph if node count grew past the cap
      if (graph) {
        graph.destroy();
        graph = null;
      }
      return;
    }

    // Lazily create graph when scope reduces count below cap
    if (!graph && canvasEl) {
      graph = createForceGraph({
        canvas: canvasEl,
        onNodeClick: onSelectFunction,
        canvasMode,
        onNodeDrag: onPinNode,
      });
    }

    if (graph) {
      graph.updateCallbacks(onSelectFunction, canvasMode, onPinNode);
      graph.update({
        nodes: functions,
        edges,
        canvasLayout,
        selectedId,
        highlightedIds,
        analysisMap,
        violationsMap,
      });
    }
  });
</script>

<div bind:this={containerEl} class="w-full h-full relative bg-void">
  <canvas bind:this={canvasEl} class="absolute inset-0"></canvas>
  {#if functions.length > 0}
    <button
      onclick={handleResetZoom}
      class="absolute bottom-3 right-3 px-2 py-1 text-[10px] font-medium text-text-secondary bg-surface-raised rounded border border-border-subtle hover:text-text hover:bg-surface-bright transition-colors cursor-pointer"
    >
      Reset View
    </button>
  {/if}
  {#if tooManyNodes}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="text-text-dim opacity-40">
        <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1" />
        <path d="M10 16h12M16 10v12" stroke="currentColor" stroke-width="1" opacity="0.5" />
      </svg>
      <span class="text-[12px] text-text-dim">
        {functions.length} functions tracked — too many to graph.
      </span>
      <span class="text-[11px] text-text-dim">
        Use the file tree, category filter, or Cmd+K search to scope.
      </span>
    </div>
  {:else if functions.length > 300}
    <div class="absolute top-2 left-1/2 -translate-x-1/2 text-sm text-text-secondary pointer-events-none">
      {functions.length} functions tracked — showing graph. Use filters or focus mode to scope.
    </div>
  {/if}
  {#if functions.length === 0}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" class="text-text-dim opacity-40">
        <circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" />
        <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.4" />
      </svg>
      <span class="text-[12px] text-text-dim">
        Waiting for signals...
      </span>
    </div>
  {/if}
</div>
