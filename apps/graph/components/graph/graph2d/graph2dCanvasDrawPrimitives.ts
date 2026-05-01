import { alignToPixel } from "./graph2dCanvasMath";

export function drawScreenCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sx: number,
  sy: number,
  color: string,
  lineWidth: number,
  dash: number[]
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  const ax = alignToPixel(sx);
  const ay = alignToPixel(sy);
  ctx.beginPath();
  ctx.moveTo(ax, 0);
  ctx.lineTo(ax, height);
  ctx.moveTo(0, ay);
  ctx.lineTo(width, ay);
  ctx.stroke();
  ctx.restore();
}

export function drawProbeLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  canvasWidth?: number,
  canvasHeight?: number
): void {
  ctx.save();
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  
  const paddingX = 7;
  const paddingY = 4;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + paddingX * 2;
  const h = 20; // Increased height for better vertical centering
  
  let left = Math.round(x - w / 2);
  let top = Math.round(y - h - 4); // Offset slightly above the point

  // Boundary clamping
  if (canvasWidth !== undefined && canvasHeight !== undefined) {
    // Avoid left/right edges
    left = Math.max(8, Math.min(left, canvasWidth - w - 8));
    // Avoid top/bottom edges
    top = Math.max(8, Math.min(top, canvasHeight - h - 8));

    // Collision avoidance for bottom-right Zoom Cluster (approx 48x120)
    if (left + w > canvasWidth - 60 && top + h > canvasHeight - 140) {
      left = canvasWidth - w - 60;
    }
    // Collision avoidance for bottom-left Status Chip (approx 180x40)
    if (left < 200 && top + h > canvasHeight - 50) {
      top = canvasHeight - h - 50;
    }
  }

  ctx.fillStyle = "rgba(15, 23, 42, 0.92)"; // Slightly more opaque
  ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
  ctx.lineWidth = 1;
  roundRect(ctx, left, top, w, h, 5); // Consistent radius
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, left + w / 2, top + h / 2 + 0.5); // +0.5 for visual optical centering
  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
