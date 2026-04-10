<script lang="ts">
  import type { CommitDiff, FunctionInfo, DiffLine } from '@agent-monitor/types';

  let {
    diff,
    activeFunctionId,
    functions,
    isLoading,
  }: {
    diff: CommitDiff | null;
    activeFunctionId: string | null;
    functions: FunctionInfo[];
    isLoading: boolean;
  } = $props();

  const lineStyles: Record<DiffLine['type'], { bg: string; text: string; prefix: string }> = {
    added: { bg: 'bg-[oklch(0.78_0.14_190/0.06)]', text: 'text-signal', prefix: '+' },
    removed: { bg: 'bg-[oklch(0.78_0.12_60/0.06)]', text: 'text-warm-dim', prefix: '-' },
    context: { bg: '', text: 'text-text-dim', prefix: ' ' },
    header: { bg: 'bg-surface/50', text: 'text-text-dim/50', prefix: ' ' },
  };

  let scrollEl = $state<HTMLDivElement>(undefined!);
  let targetEl: HTMLDivElement | undefined;
  let foundTarget = false;

  let activeFunction = $derived(
    activeFunctionId ? functions.find((f) => f.id === activeFunctionId) ?? null : null,
  );

  $effect(() => {
    // Reset target tracking when diff/function changes
    activeFunctionId;
    diff;
    targetEl = undefined;
    foundTarget = false;
  });

  $effect(() => {
    if (activeFunctionId && targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  function scrollTarget(el: HTMLElement, isTarget: boolean) {
    if (isTarget && !foundTarget) {
      foundTarget = true;
      targetEl = el as HTMLDivElement;
    }
    return {
      update(newIsTarget: boolean) {
        if (newIsTarget && !foundTarget) {
          foundTarget = true;
          targetEl = el as HTMLDivElement;
        }
      },
    };
  }
</script>

{#if isLoading}
  <div class="flex-1 flex items-center justify-center">
    <span class="text-[12px] text-text-dim">Loading diff...</span>
  </div>
{:else if !diff}
  <div class="flex-1 flex items-center justify-center">
    <span class="text-[12px] text-text-dim">Select a commit to view changes</span>
  </div>
{:else}
  <div bind:this={scrollEl} class="flex-1 overflow-auto">
    {#each diff.diffs as fileDiff (fileDiff.filePath)}
      {@const isTargetFile = activeFunction && fileDiff.filePath.endsWith(activeFunction.filePath)}
      <div>
        <div class="text-[11px] font-mono text-text-secondary bg-surface-raised/30 px-3 py-1.5 sticky top-0 z-10">
          {fileDiff.filePath}
        </div>
        <pre class="text-[11px] font-mono leading-[1.6]">
          <code>
            {#each fileDiff.lines as line, i}
              {@const style = lineStyles[line.type]}
              {@const isTargetLine =
                isTargetFile &&
                activeFunction &&
                line.newLineNo !== null &&
                line.newLineNo >= activeFunction.line &&
                line.newLineNo < activeFunction.line + 10}
              <div
                use:scrollTarget={isTargetLine}
                class="flex {style.bg} {isTargetLine ? 'ring-1 ring-signal/30' : ''}"
              >
                <span class="w-6 text-right font-mono text-[10px] text-text-dim tabular-nums select-none shrink-0 px-1">
                  {line.oldLineNo ?? ''}
                </span>
                <span class="w-6 text-right font-mono text-[10px] text-text-dim tabular-nums select-none shrink-0 px-1">
                  {line.newLineNo ?? ''}
                </span>
                <span class="flex-1 px-2 {style.text} {line.type === 'header' ? 'text-[10px]' : ''}">
                  {style.prefix}{line.content}
                </span>
              </div>
            {/each}
          </code>
        </pre>
      </div>
    {/each}
  </div>
{/if}
