<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AgentContext, FunctionCategory, CanvasLayout, AnalysisResult, RuleViolation, WsMessage } from '@agent-monitor/types';
  import { initFunctions, getFunctionsStore, handleFunctionsMessage, selectFunction } from '$lib/stores/functions.svelte';
  import { initWebSocket, getWebSocketStore } from '$lib/stores/websocket.svelte';
  import { initGitCommits, getGitCommitsStore, selectCommit, clearCommit } from '$lib/stores/gitCommits.svelte';
  import { getCanvasLayoutStore, pinNode, applyCommand, clearLayout } from '$lib/stores/canvasLayout.svelte';
  import { initAnalysis, getAnalysisStore, handleAnalysisMessage, hydrateFromSnapshot, triggerAnalysis, stopAnalysis, getAnalysesForFunction, getStreamingOutput } from '$lib/stores/analysis.svelte';
  import { initRules, getRulesStore, handleRulesMessage, updateRules, triggerCheck } from '$lib/stores/rules.svelte';
  import { getTimelineStore, handleTimelineMessage } from '$lib/stores/timeline.svelte';
  import { getGraphScopeStore, computeScope, setFocusMode, setCommitMode, setCategoryMode, clearScope } from '$lib/stores/graphScope.svelte';
  import { WS_URL } from '$lib/constants';
  import { openInEditor, launchDebugSession } from '$lib/api';

  import SidebarTabs from './Sidebar/SidebarTabs.svelte';
  import FileTree from './FileTree/FileTree.svelte';
  import CategoryFilter from './FileTree/CategoryFilter.svelte';
  import FunctionGraph from './Graph/FunctionGraph.svelte';
  import GraphScopeBar from './Graph/GraphScopeBar.svelte';
  import CommitList from './Commits/CommitList.svelte';
  import DiffView from './Commits/DiffView.svelte';
  import DetailPanel from './Detail/DetailPanel.svelte';
  import AgentModal from './Agent/AgentModal.svelte';
  import CanvasAgentPanel from './Agent/CanvasAgentPanel.svelte';
  import SearchPalette from './Search/SearchPalette.svelte';
  import RulesPanel from './Rules/RulesPanel.svelte';
  import TimelinePanel from './Timeline/TimelinePanel.svelte';

  const EMPTY_CANVAS_LAYOUT: CanvasLayout = { version: 1, positions: [], groups: [], annotations: [] };

  // Local UI state
  let isDetailOpen = $state(false);
  let isAgentModalOpen = $state(false);
  let agentContext = $state<AgentContext | null>(null);
  let sidebarTab = $state<'files' | 'commits' | 'timeline'>('files');
  let selectedCategory = $state<FunctionCategory | null>(null);
  let canvasMode = $state(false);
  let isCanvasAgentOpen = $state(false);
  let isSearchOpen = $state(false);

  // Store accessors
  let fnStore = $derived(getFunctionsStore());
  let wsStore = $derived(getWebSocketStore());
  let gitStore = $derived(getGitCommitsStore());
  let layoutStore = $derived(getCanvasLayoutStore());
  let analysisStore = $derived(getAnalysisStore());
  let scopeStore = $derived(getGraphScopeStore());
  let rulesStore = $derived(getRulesStore());
  let timelineStore = $derived(getTimelineStore());

  // Derived data
  let { scopedFunctions, scopedEdges } = $derived(computeScope(fnStore.functions, fnStore.edges));

  let filteredFunctions = $derived(
    selectedCategory
      ? fnStore.functions.filter((fn) => fn.category === selectedCategory)
      : fnStore.functions,
  );

  let selectedFunction = $derived(
    fnStore.selectedId
      ? fnStore.functions.find((f) => f.id === fnStore.selectedId) ?? null
      : null,
  );

  let scopedIds = $derived(new Set(scopedFunctions.map((f) => f.id)));

  let analysisMap = $derived.by(() => {
    const map = new Map<string, AnalysisResult[]>();
    for (const a of analysisStore.analyses) {
      if (!scopedIds.has(a.functionId)) continue;
      const existing = map.get(a.functionId);
      if (existing) {
        existing.push(a);
      } else {
        map.set(a.functionId, [a]);
      }
    }
    return map;
  });

  let violationsMap = $derived(rulesStore.violationsByFunction);

  let selectedViolations = $derived(
    fnStore.selectedId ? (violationsMap.get(fnStore.selectedId) ?? []) : [],
  );

  let activeAnalysisRunForSelected = $derived(
    analysisStore.activeRuns.find(
      (r) =>
        (r.status === 'running' || r.status === 'queued') &&
        (fnStore.selectedId && r.functionIds && r.functionIds.includes(fnStore.selectedId)),
    ),
  );

  let analysisStreamingText = $derived(
    activeAnalysisRunForSelected ? getStreamingOutput(activeAnalysisRunForSelected.runId) : '',
  );

  // Auto-scope tracking
  let prevHighlightedIds: Set<string> = new Set();
  let autoScopeApplied = false;

  $effect(() => {
    const highlighted = gitStore.highlightedFunctionIds;
    if (highlighted !== prevHighlightedIds) {
      prevHighlightedIds = highlighted;
      if (highlighted.size > 0) {
        setCommitMode(highlighted);
      } else if (scopeStore.scopeMode.type === 'commit') {
        clearScope();
      }
    }
  });

  $effect(() => {
    if (selectedCategory) {
      setCategoryMode(new Set([selectedCategory]));
    } else if (scopeStore.scopeMode.type === 'category') {
      clearScope();
    }
  });

  $effect(() => {
    if (autoScopeApplied) return;
    if (fnStore.functions.length <= 300) return;
    if (scopeStore.isScoped) return;
    if (gitStore.commits.length > 0 && gitStore.highlightedFunctionIds.size === 0) {
      selectCommit(gitStore.commits[0].hash, fnStore.functions);
      autoScopeApplied = true;
    }
  });

  // Keyboard shortcut
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      isSearchOpen = true;
    }
  }

  let cleanupWs: (() => void) | null = null;

  onMount(() => {
    initFunctions();
    initAnalysis();
    initGitCommits();
    initRules();

    cleanupWs = initWebSocket(WS_URL, (msg: WsMessage) => {
      handleFunctionsMessage(msg);
      handleTimelineMessage(msg);
      if (msg.type.startsWith('analysis-')) {
        handleAnalysisMessage(msg);
      }
      if (msg.type === 'rule-violation') {
        handleRulesMessage(msg);
      }
      if (msg.type === 'state-snapshot' && msg.payload.analyses) {
        hydrateFromSnapshot(msg.payload.analyses);
      }
    });

    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    cleanupWs?.();
    window.removeEventListener('keydown', handleKeyDown);
  });

  // Handlers
  function handleSelectFunction(id: string) {
    selectFunction(id);
    isDetailOpen = true;
  }

  function handleCloseDetail() {
    isDetailOpen = false;
  }

  function handleAskAgent(ctx: AgentContext) {
    agentContext = ctx;
    isAgentModalOpen = true;
  }

  function handleOpenEditor() {
    if (selectedFunction) {
      openInEditor(selectedFunction.filePath, selectedFunction.line);
    }
  }

  function handleCloseAgent() {
    isAgentModalOpen = false;
  }

  function handleTriggerAnalysis(functionId: string, taskName?: string) {
    triggerAnalysis([functionId], taskName);
  }

  function handleDebugFunction(opts: { filePath: string; line: number; functionName: string }) {
    launchDebugSession(opts);
  }

  function handleDebugCallChain(chain: Array<{ filePath: string; line: number; name: string }>) {
    if (chain.length === 0) return;
    const primary = chain[0];
    launchDebugSession({
      filePath: primary.filePath,
      line: primary.line,
      functionName: primary.name,
      callChain: chain,
    });
  }

  function handleSearchSelect(functionId: string) {
    selectFunction(functionId);
    isDetailOpen = true;
    setFocusMode(functionId);
    isSearchOpen = false;
  }
</script>

<div class="flex flex-col h-screen overflow-hidden bg-void">
  <!-- Top bar -->
  <header class="flex items-center justify-between h-11 px-5 border-b border-border-subtle shrink-0">
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="text-signal">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </svg>
        <span class="text-[13px] font-medium tracking-tight text-text">
          vigil
        </span>
      </div>
      <span class="text-text-dim text-[11px]">/</span>
      <span class="text-text-secondary text-[11px]">
        {fnStore.functions.length} function{fnStore.functions.length !== 1 ? 's' : ''} tracked
      </span>
      <button
        onclick={() => canvasMode = !canvasMode}
        class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-colors {canvasMode
          ? 'bg-signal/10 text-signal border border-signal/30'
          : 'text-text-dim border border-border-subtle hover:text-text'}"
      >
        Canvas
      </button>
    </div>

    <div class="flex items-center gap-2">
      <div class="w-1.5 h-1.5 rounded-full {wsStore.connected ? 'bg-signal animate-pulse' : 'bg-text-dim'}"></div>
      <span class="text-[11px] text-text-dim">
        {wsStore.connected ? 'live' : 'disconnected'}
      </span>
    </div>
  </header>

  <!-- Canvas toolbar -->
  {#if canvasMode}
    <div class="flex items-center gap-2 h-8 px-5 border-b border-border-subtle bg-surface/50 shrink-0">
      <button
        onclick={clearLayout}
        class="text-[10px] text-text-dim hover:text-text transition-colors"
      >
        Clear
      </button>
      <button
        onclick={() => isCanvasAgentOpen = !isCanvasAgentOpen}
        class="text-[10px] transition-colors {isCanvasAgentOpen ? 'text-signal' : 'text-text-dim hover:text-text'}"
      >
        Agent
      </button>
    </div>
  {/if}

  <!-- Main content -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-56 border-r border-border-subtle overflow-y-auto shrink-0 flex flex-col">
      <SidebarTabs
        active={sidebarTab}
        onChange={(tab) => {
          sidebarTab = tab;
          if (tab === 'files') clearCommit();
        }}
        timelineBadge={timelineStore.criticalCount}
      />
      {#if sidebarTab === 'files'}
        <CategoryFilter
          functions={fnStore.functions}
          {selectedCategory}
          onSelectCategory={(c) => selectedCategory = c}
        />
        <div class="px-3 py-2 border-b border-border-subtle">
          <RulesPanel
            rules={rulesStore.rules}
            violations={rulesStore.violations}
            onUpdateRules={(r) => updateRules(r)}
            onTriggerCheck={() => triggerCheck()}
          />
        </div>
        <FileTree
          files={fnStore.files}
          functions={filteredFunctions}
          highlightedIds={gitStore.highlightedFunctionIds}
          onSelectFunction={handleSelectFunction}
        />
      {/if}
      {#if sidebarTab === 'commits'}
        <CommitList
          commits={gitStore.commits}
          selectedHash={gitStore.selectedHash}
          onSelectCommit={(hash) => selectCommit(hash, fnStore.functions)}
        />
      {/if}
      {#if sidebarTab === 'timeline'}
        <TimelinePanel
          events={timelineStore.events}
          onSelectFunction={handleSelectFunction}
          filterEvents={timelineStore.filterEvents}
        />
      {/if}
    </aside>

    <!-- Main area -->
    <main class="flex-1 overflow-hidden relative flex flex-col">
      {#if sidebarTab === 'commits' && gitStore.commitDiff}
        <DiffView
          diff={gitStore.commitDiff}
          activeFunctionId={fnStore.selectedId}
          functions={fnStore.functions}
          isLoading={gitStore.isLoadingDiff}
        />
      {:else}
        <GraphScopeBar
          scopeMode={scopeStore.scopeMode}
          totalCount={fnStore.functions.length}
          scopedCount={scopedFunctions.length}
          {clearScope}
          functions={fnStore.functions}
          commitHash={gitStore.selectedHash}
        />
        <FunctionGraph
          functions={scopedFunctions}
          edges={scopedEdges}
          canvasLayout={canvasMode ? layoutStore.layout : EMPTY_CANVAS_LAYOUT}
          selectedId={fnStore.selectedId}
          highlightedIds={gitStore.highlightedFunctionIds}
          onSelectFunction={handleSelectFunction}
          onPinNode={canvasMode ? pinNode : undefined}
          {canvasMode}
          {analysisMap}
          {violationsMap}
        />
      {/if}
    </main>

    <!-- Detail panel -->
    {#if isDetailOpen && selectedFunction}
      <DetailPanel
        fn={selectedFunction}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onAskAgent={handleAskAgent}
        onOpenEditor={handleOpenEditor}
        edges={fnStore.edges}
        allFunctions={fnStore.functions}
        onSelectFunction={handleSelectFunction}
        analysisResults={getAnalysesForFunction(selectedFunction.id)}
        activeAnalysisRun={activeAnalysisRunForSelected}
        analysisStreamingText={analysisStreamingText}
        onTriggerAnalysis={handleTriggerAnalysis}
        onStopAnalysis={stopAnalysis}
        violations={selectedViolations}
        onDebugFunction={handleDebugFunction}
        onDebugCallChain={handleDebugCallChain}
        onFocusFunction={setFocusMode}
      />
    {/if}

    <!-- Canvas agent panel -->
    {#if canvasMode && isCanvasAgentOpen}
      <CanvasAgentPanel
        isOpen={isCanvasAgentOpen}
        onClose={() => isCanvasAgentOpen = false}
        onCommand={applyCommand}
        functions={fnStore.functions}
        edges={fnStore.edges}
        layout={layoutStore.layout}
      />
    {/if}
  </div>

  <!-- Agent modal -->
  {#if isAgentModalOpen && agentContext}
    <AgentModal
      isOpen={isAgentModalOpen}
      onClose={handleCloseAgent}
      context={agentContext}
    />
  {/if}

  <!-- Search palette (Cmd+K) -->
  <SearchPalette
    functions={fnStore.functions}
    isOpen={isSearchOpen}
    onClose={() => isSearchOpen = false}
    onSelect={handleSearchSelect}
  />
</div>
