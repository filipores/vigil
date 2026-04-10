'use client';

import { useEffect, useRef } from 'react';
import type { FunctionInfo, DataFlowEdge, CanvasLayout, AnalysisResult } from '@agent-monitor/types';
import { drawAnalysisBadge } from '@/components/Analysis/AnalysisBadge';
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceLink,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  opacity: number;
  age: number;
}

interface UseForceGraphOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  nodes: FunctionInfo[];
  edges: DataFlowEdge[];
  canvasLayout: CanvasLayout;
  selectedId: string | null;
  highlightedIds?: Set<string>;
  onNodeClick: (id: string) => void;
  canvasMode?: boolean;
  onNodeDrag?: (id: string, x: number, y: number) => void;
  analysisMap?: Map<string, AnalysisResult[]>;
}

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

const WARM_BG = 'rgba(200, 170, 80, 0.10)';
const WARM_BORDER = 'rgba(200, 170, 80, 0.5)';
const WARM_DOT = 'rgba(200, 170, 80, 0.8)';
const WARM_LABEL = 'rgba(200, 170, 80, 0.85)';

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const spacing = 24;
  ctx.fillStyle = GRID_DOT;
  for (let x = spacing; x < w; x += spacing) {
    for (let y = spacing; y < h; y += spacing) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export function useForceGraph({
  canvasRef,
  nodes,
  edges,
  canvasLayout,
  selectedId,
  highlightedIds,
  onNodeClick,
  canvasMode,
  onNodeDrag,
  analysisMap,
}: UseForceGraphOptions) {
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

    const nodeSetChanged = graphNodesRef.current.length !== nodes.length;
    const layoutCleared = graphNodesRef.current.length > 0 && canvasLayout.positions.length === 0;

    const graphNodes: GraphNode[] = nodes.map((fn) => {
      const existing = existingMap.get(fn.id);
      const pinned = canvasLayout.positions.find((p) => p.functionId === fn.id);
      if (existing) {
        existing.name = fn.name;
        if (pinned) {
          existing.fx = pinned.x;
          existing.fy = pinned.y;
        } else {
          existing.fx = undefined;
          existing.fy = undefined;
          if (nodeSetChanged || layoutCleared) {
            existing.x = width / 2 + (Math.random() - 0.5) * 120;
            existing.y = height / 2 + (Math.random() - 0.5) * 120;
          }
        }
        return existing;
      }
      return {
        id: fn.id,
        name: fn.name,
        x: width / 2 + (Math.random() - 0.5) * 120,
        y: height / 2 + (Math.random() - 0.5) * 120,
        fx: pinned ? pinned.x : undefined,
        fy: pinned ? pinned.y : undefined,
        opacity: 0,
        age: 0,
      };
    });

    graphNodesRef.current = graphNodes;

    if (simRef.current) {
      simRef.current.stop();
    }

    const R = 22;

    // Build link data for edges
    const nodeIdSet = new Set(graphNodes.map((n) => n.id));
    const linkData = edges
      .filter((e) => nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId))
      .map((e) => ({ source: e.sourceId, target: e.targetId, sourceId: e.sourceId, targetId: e.targetId }));

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>(48))
      .force(
        'link',
        forceLink(linkData)
          .id((n: SimulationNodeDatum & { id?: string }) => (n as GraphNode).id)
          .distance(120)
          .strength(0.3),
      )
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

        // Draw groups
        for (const group of canvasLayout.groups) {
          ctx.save();
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = group.color === 'warm' ? 'rgba(200,170,80,0.1)' : 'rgba(94,196,196,0.08)';
          ctx.strokeStyle = group.color === 'warm' ? 'rgba(200,170,80,0.3)' : 'rgba(94,196,196,0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(group.x, group.y, group.width, group.height, 8);
          ctx.fill();
          ctx.stroke();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = group.color === 'warm' ? 'rgba(200,170,80,0.85)' : 'rgba(94,196,196,0.7)';
          ctx.font = '500 9px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(group.label, group.x + 8, group.y + 14);
          ctx.restore();
        }

        // Draw annotations
        for (const ann of canvasLayout.annotations) {
          ctx.save();
          ctx.fillStyle = 'rgba(200,170,80,0.06)';
          ctx.strokeStyle = 'rgba(200,170,80,0.2)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.roundRect(ann.x, ann.y, 140, 50, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(200,170,80,0.7)';
          ctx.font = '400 9px "IBM Plex Mono", monospace';
          ctx.fillText(ann.text.slice(0, 60), ann.x + 6, ann.y + 16);
          ctx.restore();
        }

        // Draw edges
        for (const link of linkData) {
          const src = typeof link.source === 'object' ? link.source : null;
          const tgt = typeof link.target === 'object' ? link.target : null;
          if (!src || !tgt) continue;
          const sx = (src as SimulationNodeDatum).x ?? 0;
          const sy = (src as SimulationNodeDatum).y ?? 0;
          const tx = (tgt as SimulationNodeDatum).x ?? 0;
          const ty = (tgt as SimulationNodeDatum).y ?? 0;
          const isActive = link.sourceId === selectedId || link.targetId === selectedId;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = isActive ? 'rgba(94, 196, 196, 0.6)' : 'rgba(94, 196, 196, 0.25)';
          ctx.lineWidth = isActive ? 1 : 0.5;
          ctx.globalAlpha = isActive ? 0.9 : 0.7;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Draw nodes
        for (const node of graphNodes) {
          if (node.opacity < 1) node.opacity = Math.min(1, node.opacity + 0.025);
          node.age++;

          const x = node.x ?? 0;
          const y = node.y ?? 0;
          const isSelected = node.id === selectedId;
          const isHighlighted = !isSelected && highlightedIds?.has(node.id);

          ctx.globalAlpha = node.opacity;

          // Glow ring for new nodes
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

          // Analysis badge
          if (analysisMap) {
            const results = analysisMap.get(node.id);
            if (results && results.length > 0) {
              const concerns = results.flatMap((r) => r.concerns);
              const hasConcerns = concerns.length > 0;
              let maxSeverity: string | undefined;
              if (hasConcerns) {
                if (concerns.some((c) => c.severity === 'critical')) {
                  maxSeverity = 'critical';
                } else if (concerns.some((c) => c.severity === 'warning')) {
                  maxSeverity = 'warning';
                } else {
                  maxSeverity = 'info';
                }
              }
              drawAnalysisBadge(ctx, x, y, R, { hasAnalysis: true, hasConcerns, maxSeverity });
            }
          }

          ctx.globalAlpha = 1;
        }

        ctx.restore();
      });

    simRef.current = simulation;

    if (canvasMode) {
      let dragging: { nodeId: string; node: GraphNode } | null = null;
      let moved = false;

      const findNode = (mx: number, my: number): GraphNode | null => {
        for (const node of graphNodes) {
          const dx = (node.x ?? 0) - mx;
          const dy = (node.y ?? 0) - my;
          if (dx * dx + dy * dy < (R + 8) * (R + 8)) return node;
        }
        return null;
      };

      const onPointerDown = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const node = findNode(mx, my);
        if (node) {
          dragging = { nodeId: node.id, node };
          moved = false;
          canvas.setPointerCapture(e.pointerId);
          node.fx = node.x;
          node.fy = node.y;
          simulation.alphaTarget(0.3).restart();
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragging) {
          dragging.node.fx = mx;
          dragging.node.fy = my;
          moved = true;
        } else {
          canvas.style.cursor = findNode(mx, my) ? 'grab' : 'default';
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (dragging) {
          canvas.releasePointerCapture(e.pointerId);
          simulation.alphaTarget(0);
          if (!moved) {
            onNodeClick(dragging.nodeId);
          } else {
            const finalX = dragging.node.fx ?? dragging.node.x ?? 0;
            const finalY = dragging.node.fy ?? dragging.node.y ?? 0;
            onNodeDrag?.(dragging.nodeId, finalX, finalY);
          }
          dragging = null;
          moved = false;
        }
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);

      return () => {
        simulation.stop();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
      };
    } else {
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
    }
  }, [canvasRef, nodes, edges, canvasLayout, selectedId, highlightedIds, onNodeClick, canvasMode, onNodeDrag, analysisMap]);
}
