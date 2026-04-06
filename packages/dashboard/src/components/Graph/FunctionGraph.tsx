'use client';

import { useRef, useEffect } from 'react';
import type { FunctionInfo, DataFlowEdge, CanvasLayout } from '@agent-monitor/types';
import { useForceGraph } from './useForceGraph';

interface FunctionGraphProps {
  functions: FunctionInfo[];
  edges: DataFlowEdge[];
  canvasLayout: CanvasLayout;
  selectedId: string | null;
  highlightedIds?: Set<string>;
  onSelectFunction: (id: string) => void;
  onPinNode?: (id: string, x: number, y: number) => void;
  canvasMode?: boolean;
}

export function FunctionGraph({ functions, edges, canvasLayout, selectedId, highlightedIds, onSelectFunction, onPinNode, canvasMode }: FunctionGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useForceGraph({
    canvasRef,
    nodes: functions,
    edges,
    canvasLayout,
    selectedId,
    highlightedIds,
    onNodeClick: onSelectFunction,
    canvasMode,
    onNodeDrag: onPinNode,
  });

  return (
    <div ref={containerRef} className="w-full h-full relative bg-void">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {functions.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-text-dim opacity-40">
            <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.4" />
          </svg>
          <span className="text-[12px] text-text-dim">
            Waiting for signals...
          </span>
        </div>
      )}
    </div>
  );
}
