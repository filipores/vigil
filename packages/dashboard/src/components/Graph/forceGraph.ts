import type { FunctionInfo, DataFlowEdge, CanvasLayout, AnalysisResult, RuleViolation } from '@agent-monitor/types';
import { drawAnalysisBadge } from '../Analysis/AnalysisBadge';
import { drawViolationBadge } from '../Rules/ViolationBadge';
import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceLink,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { zoom, zoomIdentity, type ZoomTransform, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  opacity: number;
  age: number;
}

export interface ForceGraphOptions {
  canvas: HTMLCanvasElement;
  onNodeClick: (id: string) => void;
  canvasMode?: boolean;
  onNodeDrag?: (id: string, x: number, y: number) => void;
}

export interface ForceGraphUpdateData {
  nodes: FunctionInfo[];
  edges: DataFlowEdge[];
  canvasLayout: CanvasLayout;
  selectedId: string | null;
  highlightedIds?: Set<string>;
  analysisMap?: Map<string, AnalysisResult[]>;
  violationsMap?: Map<string, RuleViolation[]>;
}

const VOID = '#1e1e24';
const GRID_DOT = 'rgba(255, 255, 255, 0.035)';
const NODE_BG = 'rgba(255, 255, 255, 0.06)';
const NODE_BORDER = 'rgba(255, 255, 255, 0.10)';
const NODE_SELECTED_BG = 'rgba(80, 200, 200, 0.10)';
const NODE_SELECTED_BORDER = 'rgba(80, 200, 200, 0.5)';
const SIGNAL = '#5ec4c4';
const SIGNAL_GLOW = 'rgba(80, 200, 200, 0.08)';
const LABEL_COLOR = 'rgba(255, 255, 255, 0.7)';
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

export function createForceGraph(opts: ForceGraphOptions) {
  const { canvas } = opts;
  let { onNodeClick, canvasMode, onNodeDrag } = opts;
  let simulation: Simulation<GraphNode, never> | null = null;
  let graphNodes: GraphNode[] = [];
  let hoveredId: string | null = null;
  let currentAnalysisMap: Map<string, AnalysisResult[]> | undefined;
  let currentViolationsMap: Map<string, RuleViolation[]> | undefined;

  // Event listener cleanup trackers
  let cleanupListeners: (() => void) | null = null;
  let lastCanvasMode: boolean | undefined = canvasMode;
  let isDragging = false;

  const R = 22;

  // Zoom state
  let currentTransform: ZoomTransform = zoomIdentity;

  const zoomBehavior: ZoomBehavior<HTMLCanvasElement, unknown> = zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, 4])
    .filter((event: Event) => {
      // In canvas mode, don't let zoom intercept pointer events on nodes
      // (we need those for drag-to-pin). Allow wheel events always.
      if (event.type === 'wheel') return true;
      if (event.type === 'dblclick') return true;
      if (!canvasMode) return true;
      // For pointer/mouse events in canvas mode, only allow pan when not over a node
      const me = event as MouseEvent;
      const rect = canvas.getBoundingClientRect();
      const [wx, wy] = screenToWorld(me.clientX - rect.left, me.clientY - rect.top);
      for (const node of graphNodes) {
        const dx = (node.x ?? 0) - wx;
        const dy = (node.y ?? 0) - wy;
        if (dx * dx + dy * dy < (R + 8) * (R + 8)) return false;
      }
      return true;
    })
    .on('zoom', (event) => {
      currentTransform = event.transform;
      draw();
    });

  select(canvas).call(zoomBehavior);

  function screenToWorld(screenX: number, screenY: number): [number, number] {
    return [
      (screenX - currentTransform.x) / currentTransform.k,
      (screenY - currentTransform.y) / currentTransform.k,
    ];
  }

  function resetZoom() {
    select(canvas).transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
  }

  // Mutable draw-state captured by draw() and updated by update()
  let drawCtx: CanvasRenderingContext2D | null = null;
  let drawWidth = 0;
  let drawHeight = 0;
  let drawSelectedId: string | null = null;
  let drawHighlightedIds: Set<string> | undefined;
  let drawIsScaled = false;
  let drawPinnedIds = new Set<string>();
  let drawCanvasLayout: ForceGraphUpdateData['canvasLayout'] = { positions: [], groups: [], annotations: [] };
  let drawLinkData: Array<{ source: unknown; target: unknown; sourceId: string; targetId: string }> = [];

  function draw() {
    const ctx = drawCtx;
    if (!ctx) return;
    const width = drawWidth;
    const height = drawHeight;
    const selectedId = drawSelectedId;
    const highlightedIds = drawHighlightedIds;
    const isScaled = drawIsScaled;
    const pinnedIds = drawPinnedIds;
    const canvasLayout = drawCanvasLayout;
    const linkData = drawLinkData;

    const k = currentTransform.k;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Draw background (in screen space, before zoom transform)
    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, width, height);
    drawDotGrid(ctx, width, height);

    // Apply zoom transform for all world-space content
    ctx.translate(currentTransform.x, currentTransform.y);
    ctx.scale(k, k);

    // Compute visible bounds in world space for viewport culling
    const CULL_MARGIN = 100;
    const visibleBounds = {
      left: -currentTransform.x / k - CULL_MARGIN,
      top: -currentTransform.y / k - CULL_MARGIN,
      right: (width - currentTransform.x) / k + CULL_MARGIN,
      bottom: (height - currentTransform.y) / k + CULL_MARGIN,
    };

    function inBounds(x: number, y: number): boolean {
      return x >= visibleBounds.left && x <= visibleBounds.right &&
             y >= visibleBounds.top && y <= visibleBounds.bottom;
    }

    // Level-of-detail flags
    const skipLabels = k < 0.4;
    const simplifiedNodes = k < 0.2;
    const showAllLabels = k > 1.5;

    // Draw groups
    for (const group of canvasLayout.groups) {
      if (group.x + group.width < visibleBounds.left || group.x > visibleBounds.right ||
          group.y + group.height < visibleBounds.top || group.y > visibleBounds.bottom) continue;
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = group.color === 'warm' ? 'rgba(200,170,80,0.1)' : 'rgba(94,196,196,0.08)';
      ctx.strokeStyle = group.color === 'warm' ? 'rgba(200,170,80,0.3)' : 'rgba(94,196,196,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(group.x, group.y, group.width, group.height, 8);
      ctx.fill();
      ctx.stroke();
      if (!skipLabels) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = group.color === 'warm' ? 'rgba(200,170,80,0.85)' : 'rgba(94,196,196,0.7)';
        ctx.font = '500 9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(group.label, group.x + 8, group.y + 14);
      }
      ctx.restore();
    }

    // Draw annotations
    if (!skipLabels) {
      for (const ann of canvasLayout.annotations) {
        if (!inBounds(ann.x, ann.y)) continue;
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
    }

    // Draw edges
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = 'rgba(94, 196, 196, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const activeEdges: Array<{ sx: number; sy: number; tx: number; ty: number }> = [];
    for (const link of linkData) {
      const src = typeof link.source === 'object' ? link.source : null;
      const tgt = typeof link.target === 'object' ? link.target : null;
      if (!src || !tgt) continue;
      const sx = (src as SimulationNodeDatum).x ?? 0;
      const sy = (src as SimulationNodeDatum).y ?? 0;
      const tx = (tgt as SimulationNodeDatum).x ?? 0;
      const ty = (tgt as SimulationNodeDatum).y ?? 0;
      // Cull edges where both endpoints are off-screen
      if (!inBounds(sx, sy) && !inBounds(tx, ty)) continue;
      const isActive = link.sourceId === selectedId || link.targetId === selectedId;
      if (isActive) {
        activeEdges.push({ sx, sy, tx, ty });
      } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
      }
    }
    ctx.stroke();

    if (activeEdges.length > 0) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(94, 196, 196, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const e of activeEdges) {
        ctx.moveTo(e.sx, e.sy);
        ctx.lineTo(e.tx, e.ty);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw nodes
    for (const node of graphNodes) {
      if (node.opacity < 1) node.opacity = Math.min(1, node.opacity + 0.025);
      node.age++;

      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Viewport culling
      if (!inBounds(x, y)) continue;

      const isSelected = node.id === selectedId;
      const isHighlighted = !isSelected && highlightedIds?.has(node.id);

      ctx.globalAlpha = node.opacity;

      // Simplified rendering at very low zoom
      if (simplifiedNodes) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? SIGNAL : isHighlighted ? WARM_DOT : 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      // Glow ring for new nodes
      if (node.age < 120) {
        if (isScaled) {
          const glowAlpha = (1 - node.age / 120) * 0.25;
          const glowR = R + 8 + (node.age / 120) * 12;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(80, 200, 200, ${glowAlpha * 0.5})`;
          ctx.fill();
        } else {
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
      }

      // Selected glow
      if (isSelected) {
        if (isScaled) {
          ctx.beginPath();
          ctx.arc(x, y, R + 20, 0, Math.PI * 2);
          ctx.fillStyle = SIGNAL_GLOW;
          ctx.fill();
        } else {
          const gradient = ctx.createRadialGradient(x, y, R, x, y, R + 20);
          gradient.addColorStop(0, SIGNAL_GLOW);
          gradient.addColorStop(1, 'rgba(80, 200, 200, 0)');
          ctx.beginPath();
          ctx.arc(x, y, R + 20, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }
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

      // Label (with level-of-detail)
      if (!skipLabels) {
        const showLabel = showAllLabels || !isScaled || isSelected || node.id === hoveredId || pinnedIds.has(node.id);
        if (showLabel) {
          ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const label = node.name.length > 16 ? node.name.slice(0, 15) + '\u2026' : node.name;
          const textWidth = ctx.measureText(label).width;
          // Dark background for contrast
          ctx.fillStyle = 'oklch(0.13 0.005 260 / 0.7)';
          ctx.fillRect(x - textWidth / 2 - 2, y + R + 4, textWidth + 4, 16);
          // Label text
          ctx.fillStyle = isSelected ? LABEL_SELECTED : isHighlighted ? WARM_LABEL : LABEL_COLOR;
          ctx.fillText(label, x, y + R + 6);
        }
      }

      // Analysis badge
      if (currentAnalysisMap) {
        const results = currentAnalysisMap.get(node.id);
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

      // Violation badge
      if (currentViolationsMap) {
        const nodeViolations = currentViolationsMap.get(node.id);
        if (nodeViolations && nodeViolations.length > 0) {
          let highestSeverity: 'info' | 'warning' | 'critical' = 'info';
          for (const v of nodeViolations) {
            if (v.severity === 'critical') { highestSeverity = 'critical'; break; }
            if (v.severity === 'warning') highestSeverity = 'warning';
          }
          drawViolationBadge(ctx, x, y, R, highestSeverity);
        }
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function setupListeners(isCanvasMode: boolean | undefined, sim: Simulation<GraphNode, never>) {
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }

    if (isCanvasMode) {
      let dragging: { nodeId: string; node: GraphNode } | null = null;
      let moved = false;

      const findNode = (mx: number, my: number): GraphNode | null => {
        const [wx, wy] = screenToWorld(mx, my);
        for (const node of graphNodes) {
          const dx = (node.x ?? 0) - wx;
          const dy = (node.y ?? 0) - wy;
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
          isDragging = true;
          canvas.setPointerCapture(e.pointerId);
          node.fx = node.x;
          node.fy = node.y;
          sim.alphaTarget(0.3).restart();
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragging) {
          const [wx, wy] = screenToWorld(mx, my);
          dragging.node.fx = wx;
          dragging.node.fy = wy;
          moved = true;
        } else {
          const hovered = findNode(mx, my);
          hoveredId = hovered ? hovered.id : null;
          canvas.style.cursor = hovered ? 'grab' : 'default';
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (dragging) {
          canvas.releasePointerCapture(e.pointerId);
          sim.alphaTarget(0);
          if (!moved) {
            onNodeClick(dragging.nodeId);
          } else {
            const finalX = dragging.node.fx ?? dragging.node.x ?? 0;
            const finalY = dragging.node.fy ?? dragging.node.y ?? 0;
            onNodeDrag?.(dragging.nodeId, finalX, finalY);
          }
          dragging = null;
          moved = false;
          isDragging = false;
        }
      };

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);

      cleanupListeners = () => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
      };
    } else {
      const handleClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const [wx, wy] = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

        for (const node of graphNodes) {
          const dx = (node.x ?? 0) - wx;
          const dy = (node.y ?? 0) - wy;
          if (dx * dx + dy * dy < (R + 8) * (R + 8)) {
            onNodeClick(node.id);
            return;
          }
        }
      };

      const handleMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const [wx, wy] = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        let hoveredNode: GraphNode | null = null;

        for (const node of graphNodes) {
          const dx = (node.x ?? 0) - wx;
          const dy = (node.y ?? 0) - wy;
          if (dx * dx + dy * dy < (R + 8) * (R + 8)) {
            hoveredNode = node;
            break;
          }
        }

        hoveredId = hoveredNode ? hoveredNode.id : null;
        canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
      };

      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('mousemove', handleMove);

      cleanupListeners = () => {
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('mousemove', handleMove);
      };
    }
  }

  function update(data: ForceGraphUpdateData) {
    const { nodes, edges, canvasLayout, selectedId, highlightedIds, analysisMap, violationsMap } = data;
    currentAnalysisMap = analysisMap;
    currentViolationsMap = violationsMap;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawCtx = ctx;
    drawWidth = canvas.offsetWidth;
    drawHeight = canvas.offsetHeight;
    drawSelectedId = selectedId;
    drawHighlightedIds = highlightedIds;
    drawCanvasLayout = canvasLayout;

    const width = drawWidth;
    const height = drawHeight;

    const existingMap = new Map<string, GraphNode>();
    for (const n of graphNodes) {
      existingMap.set(n.id, n);
    }

    const nodeSetChanged = graphNodes.length !== nodes.length;
    const layoutCleared = graphNodes.length > 0 && canvasLayout.positions.length === 0;

    const newGraphNodes: GraphNode[] = nodes.map((fn) => {
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

    graphNodes = newGraphNodes;

    if (simulation) {
      simulation.stop();
    }

    const nodeIdSet = new Set(graphNodes.map((n) => n.id));
    const linkData = edges
      .filter((e) => nodeIdSet.has(e.sourceId) && nodeIdSet.has(e.targetId))
      .map((e) => ({ source: e.sourceId, target: e.targetId, sourceId: e.sourceId, targetId: e.targetId }));
    drawLinkData = linkData;

    const isLarge = graphNodes.length > 500;
    const isVeryLarge = graphNodes.length > 1000;
    drawIsScaled = graphNodes.length > 300;

    const sim = forceSimulation<GraphNode>(graphNodes)
      .force('charge', forceManyBody().strength(isLarge ? -80 : -180))
      .force('center', forceCenter(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>(isLarge ? 24 : 48))
      .force(
        'link',
        forceLink(linkData)
          .id((n: SimulationNodeDatum & { id?: string }) => (n as GraphNode).id)
          .distance(120)
          .strength(0.3),
      );

    if (isLarge) {
      sim.alphaDecay(0.05).alphaMin(0.05);
    }
    if (isVeryLarge) {
      sim.velocityDecay(0.6);
    }

    drawPinnedIds = new Set(canvasLayout.positions.map((p) => p.functionId));

    sim.on('tick', draw);

    simulation = sim;

    // Only re-register listeners when canvasMode changes (not on every data update)
    const modeChanged = canvasMode !== lastCanvasMode;
    lastCanvasMode = canvasMode;

    if (modeChanged || !cleanupListeners) {
      // If a drag is in progress, defer re-registration until drag completes
      if (isDragging) {
        const pendingMode = canvasMode;
        const checkDragDone = () => {
          if (!isDragging) {
            setupListeners(pendingMode, sim);
          } else {
            requestAnimationFrame(checkDragDone);
          }
        };
        requestAnimationFrame(checkDragDone);
      } else {
        setupListeners(canvasMode, sim);
      }
    }
  }

  function updateCallbacks(newOnNodeClick: (id: string) => void, newCanvasMode?: boolean, newOnNodeDrag?: (id: string, x: number, y: number) => void) {
    onNodeClick = newOnNodeClick;
    canvasMode = newCanvasMode;
    onNodeDrag = newOnNodeDrag;
  }

  function destroy() {
    if (simulation) {
      simulation.stop();
      simulation = null;
    }
    if (cleanupListeners) {
      cleanupListeners();
      cleanupListeners = null;
    }
    // Remove zoom behavior
    select(canvas).on('.zoom', null);
    graphNodes = [];
  }

  return { update, updateCallbacks, destroy, resetZoom };
}
