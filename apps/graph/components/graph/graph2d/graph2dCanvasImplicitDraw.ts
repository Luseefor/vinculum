import type { DrawContext } from "./graph2dCanvasTypes";
import { clamp } from "./graph2dCanvasMath";

export function drawHatchedDomain(
  domain: { hMin: number; hMax: number; vMin: number; vMax: number },
  ctx: CanvasRenderingContext2D,
  dc: DrawContext,
  color: string
) {
  const topLeft = {
    x: (domain.hMin - dc.centerX) * dc.scale + dc.width / 2,
    y: -(domain.vMax - dc.centerY) * dc.scale + dc.height / 2
  };
  const bottomRight = {
    x: (domain.hMax - dc.centerX) * dc.scale + dc.width / 2,
    y: -(domain.vMin - dc.centerY) * dc.scale + dc.height / 2
  };
  const left = Math.min(topLeft.x, bottomRight.x);
  const right = Math.max(topLeft.x, bottomRight.x);
  const top = Math.min(topLeft.y, bottomRight.y);
  const bottom = Math.max(topLeft.y, bottomRight.y);
  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();

  ctx.fillStyle = `${color}1f`;
  ctx.fillRect(left, top, width, height);

  ctx.strokeStyle = `${color}7a`;
  ctx.lineWidth = 1;
  const spacing = 10;
  for (let x = left - height; x <= right + height; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x + height, top);
    ctx.stroke();
  }
  ctx.restore();
}

function interpolateZeroCrossing(
  x1: number,
  y1: number,
  v1: number,
  x2: number,
  y2: number,
  v2: number
): { x: number; y: number } | null {
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
    return null;
  }
  if (Math.abs(v1 - v2) < 1e-12) {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  }
  const t = clamp(v1 / (v1 - v2), 0, 1);
  return {
    x: x1 + (x2 - x1) * t,
    y: y1 + (y2 - y1) * t
  };
}

export function drawImplicitContour(
  evaluate: (horizontalValue: number, verticalValue: number) => number | null,
  ctx: CanvasRenderingContext2D,
  dc: DrawContext,
  width: number,
  height: number
) {
  const cols = clamp(Math.round(width / 9), 40, 220);
  const rows = clamp(Math.round(height / 9), 40, 220);
  const values = new Float64Array((cols + 1) * (rows + 1));

  const sampleValue = (gridX: number, gridY: number): number => {
    const px = (gridX / cols) * width;
    const py = (gridY / rows) * height;
    const horizontal = (px - width / 2) / dc.scale + dc.centerX;
    const vertical = -(py - height / 2) / dc.scale + dc.centerY;
    const value = evaluate(horizontal, vertical);
    return value === null ? Number.NaN : value;
  };

  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      values[y * (cols + 1) + x] = sampleValue(x, y);
    }
  }

  const cellWidth = width / cols;
  const cellHeight = height / rows;
  const getValue = (x: number, y: number) => values[y * (cols + 1) + x];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const x0 = x * cellWidth;
      const y0 = y * cellHeight;
      const x1 = (x + 1) * cellWidth;
      const y1 = (y + 1) * cellHeight;

      const a = getValue(x, y);
      const b = getValue(x + 1, y);
      const c = getValue(x + 1, y + 1);
      const d = getValue(x, y + 1);
      if (![a, b, c, d].every(Number.isFinite)) {
        continue;
      }

      const intersections: Array<{ x: number; y: number }> = [];
      const edges: Array<[number, number, number, number, number, number]> = [
        [x0, y0, a, x1, y0, b],
        [x1, y0, b, x1, y1, c],
        [x1, y1, c, x0, y1, d],
        [x0, y1, d, x0, y0, a]
      ];
      for (const [ex1, ey1, ev1, ex2, ey2, ev2] of edges) {
        const crosses =
          (ev1 === 0 && ev2 !== 0) ||
          (ev2 === 0 && ev1 !== 0) ||
          (ev1 < 0 && ev2 > 0) ||
          (ev1 > 0 && ev2 < 0);
        if (!crosses) {
          continue;
        }
        const point = interpolateZeroCrossing(ex1, ey1, ev1, ex2, ey2, ev2);
        if (point) {
          intersections.push(point);
        }
      }
      if (intersections.length >= 2) {
        ctx.moveTo(intersections[0].x, intersections[0].y);
        ctx.lineTo(intersections[1].x, intersections[1].y);
      }
      if (intersections.length >= 4) {
        ctx.moveTo(intersections[2].x, intersections[2].y);
        ctx.lineTo(intersections[3].x, intersections[3].y);
      }
    }
  }
}
