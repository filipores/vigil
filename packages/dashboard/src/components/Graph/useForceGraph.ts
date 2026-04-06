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
  age: number; // ticks since creation — drives pulse
}

interface UseForceGraphOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nodes: FunctionInfo[];
  selectedId: string | null;
  highlightedIds?: Set<string>;
  onNodeClick: (id: string) => void;
}

// Colors from the design system
const VOID = '#1e1e24';
const GRID_DOT = 'rgba(255, 255, 255, 0.035)';
const NODE_BG = 'rgba(255, 255, 255, 0.06)';
const NODE_BORDER = 'rgba(255, 255, 255, 0.10)';
const NODE_SELECTED_BG = 'rgba(80, 200, 200, 0.10)';
const NODE_SELECTED_BORDER = 'rgba(80, 200, 200, 0.5)';
const SIGNAL = '#5ec4c4';
const SIGNAL_GLOW = 'rgba(80, 200, 200, 0.08)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.55)';
const LABEL_SELECTED = 'rgba(255, 255, 255, 0.85)';

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spacing = 24;
  ctx.fillStyle = GRID_DOT;
  for (let x = spacing; x < w; x += spacing) {
    for (let y = spacing; y < h; y += spacing) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

// Warm highlight colors
const WARM_BG = 'rgba(200, 170, 80, 0.10)';
const WARM_BORDER = 'rgba(200, 170, 80, 0.5)';
const WARM_DOT = 'rgba(200, 170, 80, 0.8)';
const WARM_LABEL = 'rgba(200, 170, 80, 0.85)';

export function useForceGraph({ canvasRef, nodes, selectedId, highlightedIds, onNodeClick }: UseForceGraphOptions) {
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
        x: width / 2 + (Math.random() - 0.5) * 120,
        y: height / 2 + (Math.random() - 0.5) * 120,
        opacity: 0,
        age: 0,
      };
    });

    graphNodesRef.current = graphNodes;

    if (simRef.current) {
      simRef.current.stop();
    }

    const R = 22;

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>(48))
      .on('tick', () => {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = VOID;
        ctx.fillRect(0, 0, width, height);

        // Dot grid
        drawDotGrid(ctx, width, height);

        // Draw nodes
        for (const node of graphNodes) {
          if (node.opacity < 1) node.opacity = Math.min(1, node.opacity + 0.025);
          node.age++;

          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const isSelected = node.id === selectedId;
          const isHighlighted = !isSelected && highlightedIds?.has(node.id);

          ctx.globalAlpha = node.opacity;

          // Glow ring for new nodes (fades over first 120 ticks)
          if (node.age < 120) {
            const glowAlpha = (1 - node.age / 120) * 0.25;
            const glowR = R + 8 + (node.age / 120) * 12;
            const gradient = ctx.createRadialGradient(x, y, R, x, y, glowR);
            gradient.addColorStop(0, `rgba(80, 200, 200, ${glowAlpha})`);
            gradient.addColorStop(1, 'rgba(80, 200, 200, 0)');
            ctx.beginPath();
            ctx.arc(x, y, glowR, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
          }

          // Selected glow
          if (isSelected) {
            const gradient = ctx.createRadialGradient(x, y, R, x, y, R + 20);
            gradient.addColorStop(0, SIGNAL_GLOW);
            gradient.addColorStop(1, 'rgba(80, 200, 200, 0)');
            ctx.beginPath();
            ctx.arc(x, y, R + 20, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
          }

          // Node circle
          ctx.beginPath();
          ctx.arc(x, y, R, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? NODE_SELECTED_BG : isHighlighted ? WARM_BG : NODE_BG;
          ctx.fill();
          ctx.strokeStyle = isSelected ? NODE_SELECTED_BORDER : isHighlighted ? WARM_BORDER : NODE_BORDER;
          ctx.lineWidth = isSelected ? 1.5 : isHighlighted ? 1 : 0.5;
          ctx.stroke();

          // Center dot
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? SIGNAL : isHighlighted ? WARM_DOT : 'rgba(255, 255, 255, 0.2)';
          ctx.fill();

          // Label
          ctx.fillStyle = isSelected ? LABEL_SELECTED : isHighlighted ? WARM_LABEL : LABEL_COLOR;
          ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = node.name.length > 16 ? node.name.slice(0, 15) + '\u2026' : node.name;
          ctx.fillText(label, x, y + R + 6);

          ctx.globalAlpha = 1;
        }

        ctx.restore();
      });

    simRef.current = simulation;

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const node of graphNodes) {
        const dx = (node.x ?? 0) - mx;
        const dy = (node.y ?? 0) - my;
        if (dx * dx + dy * dy < (R + 8) * (R + 8)) {
          onNodeClick(node.id);
          return;
        }
      }
    };

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let hovering = false;

      for (const node of graphNodes) {
        const dx = (node.x ?? 0) - mx;
        const dy = (node.y ?? 0) - my;
        if (dx * dx + dy * dy < (R + 8) * (R + 8)) {
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
