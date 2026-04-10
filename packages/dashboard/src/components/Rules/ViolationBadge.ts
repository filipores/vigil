const COLOR_CRITICAL = 'oklch(0.65 0.20 25)';
const COLOR_WARNING = 'oklch(0.78 0.12 60)';
const COLOR_INFO = 'oklch(0.55 0.05 260)';

export function drawViolationBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  nodeRadius: number,
  severity: 'info' | 'warning' | 'critical',
): void {
  // Position at 2 o'clock (approx 60 degrees from top-right)
  const angle = -Math.PI / 6; // 2 o'clock position
  const cx = x + nodeRadius * Math.cos(angle) * 0.7;
  const cy = y + nodeRadius * Math.sin(angle) * 0.7;
  const s = 5;

  let color: string;
  switch (severity) {
    case 'critical':
      color = COLOR_CRITICAL;
      break;
    case 'warning':
      color = COLOR_WARNING;
      break;
    default:
      color = COLOR_INFO;
  }

  ctx.save();
  ctx.beginPath();
  // Triangle pointing up (warning symbol)
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.87, cy + s * 0.5);
  ctx.lineTo(cx - s * 0.87, cy + s * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
