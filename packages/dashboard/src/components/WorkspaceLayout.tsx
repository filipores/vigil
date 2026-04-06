'use client';

import { useState, useCallback, useMemo } from 'react';
import type { AgentContext, FunctionCategory } from '@agent-monitor/types';
import { useFunctions } from '@/hooks/useFunctions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useGitCommits } from '@/hooks/useGitCommits';
import { WS_URL } from '@/lib/constants';
import { SidebarTabs } from '@/components/Sidebar/SidebarTabs';
import { FileTree } from '@/components/FileTree/FileTree';
import { CategoryFilter } from '@/components/FileTree/CategoryFilter';
import { FunctionGraph } from '@/components/Graph/FunctionGraph';
import { CommitList } from '@/components/Commits/CommitList';
import { DiffView } from '@/components/Commits/DiffView';
import { DetailPanel } from '@/components/Detail/DetailPanel';
import { AgentModal } from '@/components/Agent/AgentModal';
import { openInEditor } from '@/lib/api';

export function WorkspaceLayout() {
  const { functions, files, selectedId, selectFunction } = useFunctions();
  const { connected } = useWebSocket({ url: WS_URL, onMessage: () => {} });
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'commits'>('files');
  const [selectedCategory, setSelectedCategory] = useState<FunctionCategory | null>(null);

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
              agent monitor
            </span>
          </div>
          <span className="text-text-dim text-[11px]">/</span>
          <span className="text-text-secondary text-[11px]">
            {functions.length} function{functions.length !== 1 ? 's' : ''} tracked
          </span>
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
              selectedId={selectedId}
              highlightedIds={highlightedFunctionIds}
              onSelectFunction={handleSelectFunction}
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
