import type { CanvasGroup, CanvasAnnotation } from './canvas.js';

export interface CreateGroupCommand {
  type: 'create-group';
  group: Omit<CanvasGroup, 'id'> & { id?: string };
}
export interface AddToGroupCommand {
  type: 'add-to-group';
  groupId: string;
  functionIds: string[];
}
export interface MoveNodeCommand {
  type: 'move-node';
  functionId: string;
  x: number;
  y: number;
}
export interface AddAnnotationCommand {
  type: 'add-annotation';
  annotation: Omit<CanvasAnnotation, 'id'>;
}
export interface ClearGroupCommand {
  type: 'clear-group';
  groupId: string;
}
export type CanvasCommand =
  | CreateGroupCommand
  | AddToGroupCommand
  | MoveNodeCommand
  | AddAnnotationCommand
  | ClearGroupCommand;
