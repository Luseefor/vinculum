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

export function drawProbeLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.save();
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
  const paddingX = 6;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + paddingX * 2;
  const h = 18;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h);

  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
  ctx.lineWidth = 1;
  roundRect(ctx, left, top, w, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + paddingX, top + h / 2);
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
