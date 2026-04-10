'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AgentContext, FunctionCategory, CanvasLayout, AnalysisResult } from '@agent-monitor/types';
import { useFunctions } from '@/hooks/useFunctions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGitCommits } from '@/hooks/useGitCommits';
import { useCanvasLayout } from '@/hooks/useCanvasLayout';
import { useAnalysis } from '@/hooks/useAnalysis';
import { WS_URL } from '@/lib/constants';
import { SidebarTabs } from '@/components/Sidebar/SidebarTabs';
import { FileTree } from '@/components/FileTree/FileTree';
import { CategoryFilter } from '@/components/FileTree/CategoryFilter';
import { FunctionGraph } from '@/components/Graph/FunctionGraph';
import { CommitList } from '@/components/Commits/CommitList';
import { DiffView } from '@/components/Commits/DiffView';
import { DetailPanel } from '@/components/Detail/DetailPanel';
import { AgentModal } from '@/components/Agent/AgentModal';
import { CanvasAgentPanel } from '@/components/Agent/CanvasAgentPanel';
import { openInEditor, launchDebugSession } from '@/lib/api';

const EMPTY_CANVAS_LAYOUT: CanvasLayout = { version: 1, positions: [], groups: [], annotations: [] };

export function WorkspaceLayout() {
  const { functions, files, edges, selectedId, selectFunction, handleMessage: handleFunctionsMessage } = useFunctions();
  const {
    analyses,
    activeRuns,
    handleAnalysisMessage,
    triggerAnalysis,
    stopAnalysis,
    getAnalysesForFunction,
  } = useAnalysis();
  const { connected } = useWebSocket({
    url: WS_URL,
    onMessage: useCallback(
      (msg: import('@agent-monitor/types').WsMessage) => {
        handleFunctionsMessage(msg);
        if (msg.type.startsWith('analysis-')) {
          handleAnalysisMessage(msg);
        }
      },
      [handleFunctionsMessage, handleAnalysisMessage],
    ),
  });
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'commits'>('files');
  const [selectedCategory, setSelectedCategory] = useState<FunctionCategory | null>(null);
  const [canvasMode, setCanvasMode] = useState(false);
  const [isCanvasAgentOpen, setIsCanvasAgentOpen] = useState(false);

  const {
    layout,
    pinNode,
    applyCommand,
    clearLayout,
  } = useCanvasLayout();

  const {
    commits,
    selectedHash,
    commitDiff,
    highlightedFunctionIds,
    selectCommit,
    clearCommit,
    isLoadingDiff,
  } = useGitCommits(functions);

  const filteredFunctions = useMemo(
    () =>
      selectedCategory
        ? functions.filter((fn) => fn.category === selectedCategory)
        : functions,
    [functions, selectedCategory],
  );

  const selectedFunction = selectedId
    ? functions.find((f) => f.id === selectedId) ?? null
    : null;

  const handleSelectFunction = useCallback(
    (id: string) => {
      selectFunction(id);
      setIsDetailOpen(true);
    },
    [selectFunction],
  );

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  const handleAskAgent = useCallback((ctx: AgentContext) => {
    setAgentContext(ctx);
    setIsAgentModalOpen(true);
  }, []);

  const handleOpenEditor = useCallback(() => {
    if (selectedFunction) {
      openInEditor(selectedFunction.filePath, selectedFunction.line);
    }
  }, [selectedFunction]);

  const handleCloseAgent = useCallback(() => {
    setIsAgentModalOpen(false);
  }, []);

  const analysisMap = useMemo(() => {
    const map = new Map<string, AnalysisResult[]>();
    for (const a of analyses) {
      const existing = map.get(a.functionId);
      if (existing) {
        existing.push(a);
      } else {
        map.set(a.functionId, [a]);
      }
    }
    return map;
  }, [analyses]);

  const activeAnalysisRunForSelected = useMemo(
    () =>
      activeRuns.find(
        (r) =>
          (r.status === 'running' || r.status === 'queued') &&
          (!selectedId || (r.functionIds && r.functionIds.includes(selectedId))),
      ),
    [activeRuns, selectedId],
  );

  const handleTriggerAnalysis = useCallback(
    (functionId: string) => {
      triggerAnalysis([functionId]);
    },
    [triggerAnalysis],
  );

  const handleStopAnalysis = useCallback(
    (runId: string) => {
      stopAnalysis(runId);
    },
    [stopAnalysis],
  );

  const handleDebugFunction = useCallback(
    (opts: { filePath: string; line: number; functionName: string }) => {
      launchDebugSession(opts);
    },
    [],
  );

  const handleDebugCallChain = useCallback(
    (chain: Array<{ filePath: string; line: number; name: string }>) => {
      if (chain.length === 0) return;
      const primary = chain[0];
      launchDebugSession({
        filePath: primary.filePath,
        line: primary.line,
        functionName: primary.name,
        callChain: chain,
      });
    },
    [],
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-void">
      {/* Top bar */}
      <header className="flex items-center justify-between h-11 px-5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-signal">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2" fill="currentColor" />
            </svg>
            <span className="text-[13px] font-medium tracking-tight text-text">
              vigil
            </span>
          </div>
          <span className="text-text-dim text-[11px]">/</span>
          <span className="text-text-secondary text-[11px]">
            {functions.length} function{functions.length !== 1 ? 's' : ''} tracked
          </span>
          <button
            onClick={() => setCanvasMode((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded transition-colors ${
              canvasMode
                ? 'bg-signal/10 text-signal border border-signal/30'
                : 'text-text-dim border border-border-subtle hover:text-text'
            }`}
          >
            Canvas
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-signal animate-pulse' : 'bg-text-dim'
            }`}
          />
          <span className="text-[11px] text-text-dim">
            {connected ? 'live' : 'disconnected'}
          </span>
        </div>
      </header>

      {/* Canvas toolbar */}
      {canvasMode && (
        <div className="flex items-center gap-2 h-8 px-5 border-b border-border-subtle bg-surface/50 shrink-0">
          <button
            onClick={clearLayout}
            className="text-[10px] text-text-dim hover:text-text transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsCanvasAgentOpen((v) => !v)}
            className={`text-[10px] transition-colors ${
              isCanvasAgentOpen ? 'text-signal' : 'text-text-dim hover:text-text'
            }`}
          >
            Agent
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border-subtle overflow-y-auto shrink-0 flex flex-col">
          <SidebarTabs
            active={sidebarTab}
            onChange={(tab) => {
              setSidebarTab(tab);
              if (tab === 'files') clearCommit();
            }}
          />
          {sidebarTab === 'files' && (
            <>
              <CategoryFilter
                functions={functions}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
              <FileTree
                files={files}
                functions={filteredFunctions}
                highlightedIds={highlightedFunctionIds}
                onSelectFunction={handleSelectFunction}
              />
            </>
          )}
          {sidebarTab === 'commits' && (
            <CommitList
              commits={commits}
              selectedHash={selectedHash}
              onSelectCommit={selectCommit}
            />
          )}
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {sidebarTab === 'commits' && commitDiff ? (
            <DiffView
              diff={commitDiff}
              activeFunctionId={selectedId}
              functions={functions}
              isLoading={isLoadingDiff}
            />
          ) : (
            <FunctionGraph
              functions={filteredFunctions}
              edges={edges}
              canvasLayout={canvasMode ? layout : EMPTY_CANVAS_LAYOUT}
              selectedId={selectedId}
              highlightedIds={highlightedFunctionIds}
              onSelectFunction={handleSelectFunction}
              onPinNode={canvasMode ? pinNode : undefined}
              canvasMode={canvasMode}
              analysisMap={analysisMap}
            />
          )}
        </main>

        {/* Detail panel */}
        {isDetailOpen && selectedFunction && (
          <DetailPanel
            fn={selectedFunction}
            isOpen={isDetailOpen}
            onClose={handleCloseDetail}
            onAskAgent={handleAskAgent}
            onOpenEditor={handleOpenEditor}
            edges={edges}
            allFunctions={functions}
            onSelectFunction={handleSelectFunction}
            analysisResults={selectedFunction ? getAnalysesForFunction(selectedFunction.id) : []}
            activeAnalysisRun={activeAnalysisRunForSelected}
            onTriggerAnalysis={handleTriggerAnalysis}
            onStopAnalysis={handleStopAnalysis}
            onDebugFunction={handleDebugFunction}
            onDebugCallChain={handleDebugCallChain}
          />
        )}

        {/* Canvas agent panel */}
        {canvasMode && isCanvasAgentOpen && (
          <CanvasAgentPanel
            isOpen={isCanvasAgentOpen}
            onClose={() => setIsCanvasAgentOpen(false)}
            onCommand={applyCommand}
            functions={functions}
            edges={edges}
            layout={layout}
          />
        )}
      </div>

      {/* Agent modal */}
      {isAgentModalOpen && agentContext && (
        <AgentModal
          isOpen={isAgentModalOpen}
          onClose={handleCloseAgent}
          context={agentContext}
        />
      )}
    </div>
  );
}
