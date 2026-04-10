'use client';

const COLOR_NONE = 'oklch(0.55 0.10 190)';
const COLOR_WARNING = 'oklch(0.78 0.12 60)';
const COLOR_CRITICAL = 'oklch(0.65 0.20 25)';

export function drawAnalysisBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  nodeRadius: number,
  opts: { hasAnalysis: boolean; hasConcerns: boolean; maxSeverity?: string },
) {
  if (!opts.hasAnalysis) return;

  const cx = x - nodeRadius * 0.7;
  const cy = y - nodeRadius * 0.7;
  const s = 4;

  let color = COLOR_NONE;
  if (opts.hasConcerns) {
    color = opts.maxSeverity === 'critical' ? COLOR_CRITICAL : COLOR_WARNING;
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
