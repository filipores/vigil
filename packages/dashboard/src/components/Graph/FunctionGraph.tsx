'use client';

import { useRef, useEffect } from 'react';
import type { FunctionInfo } from '@agent-monitor/types';
import { useForceGraph } from './useForceGraph';

interface FunctionGraphProps {
  functions: FunctionInfo[];
  selectedId: string | null;
  onSelectFunction: (id: string) => void;
}

export function FunctionGraph({ functions, selectedId, onSelectFunction }: FunctionGraphProps) {
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

  useForceGraph({ canvasRef, nodes: functions, selectedId, onNodeClick: onSelectFunction });

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {functions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
          Waiting for functions...
        </div>
      )}
    </div>
  );
}
