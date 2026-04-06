'use client';

import { useState, useCallback } from 'react';
import type { AgentContext } from '@agent-monitor/types';
import { useFunctions } from '@/hooks/useFunctions';
import { FileTree } from '@/components/FileTree/FileTree';
import { FunctionGraph } from '@/components/Graph/FunctionGraph';
import { DetailPanel } from '@/components/Detail/DetailPanel';
import { AgentModal } from '@/components/Agent/AgentModal';
import { openInEditor } from '@/lib/api';

export function WorkspaceLayout() {
  const { functions, files, selectedId, selectFunction } = useFunctions();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentContext, setAgentContext] = useState<AgentContext | null>(null);

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
    <div className="flex h-screen overflow-hidden">
      <div className="w-64 border-r border-border overflow-y-auto">
        <FileTree
          files={files}
          functions={functions}
          onSelectFunction={handleSelectFunction}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <FunctionGraph
          functions={functions}
          selectedId={selectedId}
          onSelectFunction={handleSelectFunction}
        />
      </div>

      <DetailPanel
        fn={selectedFunction}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onAskAgent={handleAskAgent}
        onOpenEditor={handleOpenEditor}
      />

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
