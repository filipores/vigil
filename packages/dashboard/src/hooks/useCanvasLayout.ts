'use client';

import { useState, useCallback } from 'react';
import type { CanvasLayout, CanvasGroup, CanvasAnnotation, CanvasCommand } from '@agent-monitor/types';

const STORAGE_KEY = 'vigil:canvas-layout';

const DEFAULT_LAYOUT: CanvasLayout = {
  version: 1,
  positions: [],
  groups: [],
  annotations: [],
};

function loadLayout(): CanvasLayout {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return JSON.parse(raw) as CanvasLayout;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(layout: CanvasLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

export function useCanvasLayout() {
  const [layout, setLayout] = useState<CanvasLayout>(loadLayout);

  const update = useCallback((fn: (prev: CanvasLayout) => CanvasLayout) => {
    setLayout((prev) => {
      const next = fn(prev);
      saveLayout(next);
      return next;
    });
  }, []);

  const pinNode = useCallback((id: string, x: number, y: number) => {
    update((prev) => ({
      ...prev,
      positions: [
        ...prev.positions.filter((p) => p.functionId !== id),
        { functionId: id, x, y, pinned: true },
      ],
    }));
  }, [update]);

  const unpinNode = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      positions: prev.positions.filter((p) => p.functionId !== id),
    }));
  }, [update]);

  const upsertGroup = useCallback((group: CanvasGroup) => {
    update((prev) => ({
      ...prev,
      groups: [...prev.groups.filter((g) => g.id !== group.id), group],
    }));
  }, [update]);

  const removeGroup = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== id),
    }));
  }, [update]);

  const addAnnotation = useCallback((ann: CanvasAnnotation) => {
    update((prev) => ({
      ...prev,
      annotations: [...prev.annotations, ann],
    }));
  }, [update]);

  const removeAnnotation = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      annotations: prev.annotations.filter((a) => a.id !== id),
    }));
  }, [update]);

  const applyCommand = useCallback((cmd: CanvasCommand) => {
    switch (cmd.type) {
      case 'create-group':
        upsertGroup({ ...cmd.group, id: cmd.group.id ?? crypto.randomUUID() });
        break;
      case 'add-to-group':
        update((prev) => {
          const existing = prev.groups.find((g) => g.id === cmd.groupId);
          if (!existing) return prev;
          const merged = new Set([...existing.functionIds, ...cmd.functionIds]);
          return {
            ...prev,
            groups: prev.groups.map((g) =>
              g.id === cmd.groupId ? { ...g, functionIds: [...merged] } : g,
            ),
          };
        });
        break;
      case 'move-node':
        pinNode(cmd.functionId, cmd.x, cmd.y);
        break;
      case 'add-annotation':
        addAnnotation({ ...cmd.annotation, id: crypto.randomUUID() });
        break;
      case 'clear-group':
        removeGroup(cmd.groupId);
        break;
    }
  }, [upsertGroup, update, pinNode, addAnnotation, removeGroup]);

  const clearLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    pinNode,
    unpinNode,
    upsertGroup,
    removeGroup,
    addAnnotation,
    removeAnnotation,
    applyCommand,
    clearLayout,
  };
}
