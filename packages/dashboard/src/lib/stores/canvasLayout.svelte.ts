import type { CanvasLayout, CanvasGroup, CanvasAnnotation, CanvasCommand } from '@agent-monitor/types';

const STORAGE_KEY = 'vigil:canvas-layout';

const DEFAULT_LAYOUT: CanvasLayout = {
  version: 1,
  positions: [],
  groups: [],
  annotations: [],
};

function loadLayout(): CanvasLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return JSON.parse(raw) as CanvasLayout;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function saveLayout(l: CanvasLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(l));
  } catch {
    // ignore quota errors
  }
}

let layout = $state<CanvasLayout>(loadLayout());

function update(fn: (prev: CanvasLayout) => CanvasLayout) {
  layout = fn(layout);
  saveLayout(layout);
}

export function pinNode(id: string, x: number, y: number) {
  update((prev) => ({
    ...prev,
    positions: [
      ...prev.positions.filter((p) => p.functionId !== id),
      { functionId: id, x, y, pinned: true },
    ],
  }));
}

export function unpinNode(id: string) {
  update((prev) => ({
    ...prev,
    positions: prev.positions.filter((p) => p.functionId !== id),
  }));
}

export function upsertGroup(group: CanvasGroup) {
  update((prev) => ({
    ...prev,
    groups: [...prev.groups.filter((g) => g.id !== group.id), group],
  }));
}

export function removeGroup(id: string) {
  update((prev) => ({
    ...prev,
    groups: prev.groups.filter((g) => g.id !== id),
  }));
}

export function addAnnotation(ann: CanvasAnnotation) {
  update((prev) => ({
    ...prev,
    annotations: [...prev.annotations, ann],
  }));
}

export function removeAnnotation(id: string) {
  update((prev) => ({
    ...prev,
    annotations: prev.annotations.filter((a) => a.id !== id),
  }));
}

export function applyCommand(cmd: CanvasCommand) {
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
}

export function clearLayout() {
  layout = DEFAULT_LAYOUT;
  saveLayout(DEFAULT_LAYOUT);
}

export function getCanvasLayoutStore() {
  return {
    get layout() { return layout; },
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
