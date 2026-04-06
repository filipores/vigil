export interface PinnedPosition {
  functionId: string;
  x: number;
  y: number;
  pinned: boolean;
}

export interface CanvasGroup {
  id: string;
  label: string;
  color: string;
  functionIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface CanvasLayout {
  version: number;
  positions: PinnedPosition[];
  groups: CanvasGroup[];
  annotations: CanvasAnnotation[];
}
