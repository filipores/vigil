'use client';

import { useEffect, useRef } from 'react';
import type { FunctionInfo } from '@agent-monitor/types';
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  opacity: number;
}

interface UseForceGraphOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nodes: FunctionInfo[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
}

export function useForceGraph({ canvasRef, nodes, selectedId, onNodeClick }: UseForceGraphOptions) {
  const simRef = useRef<Simulation<GraphNode, never> | null>(null);
  const graphNodesRef = useRef<GraphNode[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    const existingMap = new Map<string, GraphNode>();
    for (const n of graphNodesRef.current) {
      existingMap.set(n.id, n);
    }

    const graphNodes: GraphNode[] = nodes.map((fn) => {
      const existing = existingMap.get(fn.id);
      if (existing) {
        existing.name = fn.name;
        return existing;
      }
      return {
        id: fn.id,
        name: fn.name,
        x: width / 2 + (Math.random() - 0.5) * 100,
        y: height / 2 + (Math.random() - 0.5) * 100,
        opacity: 0,
      };
    });

    graphNodesRef.current = graphNodes;

    if (simRef.current) {
      simRef.current.stop();
    }

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force('charge', forceManyBody().strength(-150))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<GraphNode>(40))
      .on('tick', () => {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        for (const node of graphNodes) {
          if (node.opacity < 1) node.opacity = Math.min(1, node.opacity + 0.02);
          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const r = 24;
          const isSelected = node.id === selectedId;

          ctx.globalAlpha = node.opacity;

          // Node circle
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = '#eaeaea'; // surface-raised
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#4a6fa5' : '#d9d9d9'; // accent or border
          ctx.lineWidth = isSelected ? 3 : 1;
          ctx.stroke();

          // Label
          ctx.fillStyle = '#333333'; // text-primary
          ctx.font = '10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = node.name.length > 12 ? node.name.slice(0, 11) + '...' : node.name;
          ctx.fillText(label, x, y + r + 4);

          ctx.globalAlpha = 1;
        }

        ctx.restore();
      });

    simRef.current = simulation;

    // Click handler
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const node of graphNodes) {
        const dx = (node.x ?? 0) - mx;
        const dy = (node.y ?? 0) - my;
        if (dx * dx + dy * dy < 24 * 24) {
          onNodeClick(node.id);
          return;
        }
      }
    };

    // Hover cursor
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hovering = false;

      for (const node of graphNodes) {
        const dx = (node.x ?? 0) - mx;
        const dy = (node.y ?? 0) - my;
        if (dx * dx + dy * dy < 24 * 24) {
          hovering = true;
          break;
        }
      }

      canvas.style.cursor = hovering ? 'pointer' : 'default';
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMove);

    return () => {
      simulation.stop();
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMove);
    };
  }, [canvasRef, nodes, selectedId, onNodeClick]);
}
