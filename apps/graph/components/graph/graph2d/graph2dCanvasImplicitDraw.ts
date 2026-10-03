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

const contourPaths = new WeakMap<Function, { key: string; points: Float32Array }>();

export function drawImplicitContour(
  evaluate: (horizontalValue: number, verticalValue: number) => number | null,
  ctx: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo">,
  dc: Omit<DrawContext, "ctx">,
  width: number,
  height: number
) {
  const key = `${width}:${height}:${dc.centerX}:${dc.centerY}:${dc.scale}`;
  const cached = contourPaths.get(evaluate);
  if (cached?.key === key) {
    for (let index = 0; index < cached.points.length; index += 4) {
      ctx.moveTo(cached.points[index], cached.points[index + 1]);
      ctx.lineTo(cached.points[index + 2], cached.points[index + 3]);
    }
    return;
  }
  const points: number[] = [];
  const drawSegment = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    points.push(start.x, start.y, end.x, end.y);
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
  };
  const cols = clamp(Math.ceil(width / 3), 40, 768);
  const rows = clamp(Math.ceil(height / 3), 40, 768);
  const sampleXYGrid = (evaluate as typeof evaluate & { sampleXYGrid?: (xMin: number, xMax: number, columns: number, yMin: number, yMax: number, rows: number) => Float64Array }).sampleXYGrid;
  const values = sampleXYGrid ? sampleXYGrid(dc.centerX - width / (2 * dc.scale), dc.centerX + width / (2 * dc.scale), cols + 1, dc.centerY + height / (2 * dc.scale), dc.centerY - height / (2 * dc.scale), rows + 1) : new Float64Array((cols + 1) * (rows + 1));

  const sampleValue = (gridX: number, gridY: number): number => {
    const px = (gridX / cols) * width;
    const py = (gridY / rows) * height;
    const horizontal = (px - width / 2) / dc.scale + dc.centerX;
    const vertical = -(py - height / 2) / dc.scale + dc.centerY;
    const value = evaluate(horizontal, vertical);
    return value === null ? Number.NaN : value;
  };

  if (!sampleXYGrid) for (let y = 0; y <= rows; y += 1) {
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
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) {
        continue;
      }
      // Most cells contain no crossing. Reject them before allocating
      // intersections or inspecting edges; zeros must still reach extraction.
      if ((a > 0 && b > 0 && c > 0 && d > 0) || (a < 0 && b < 0 && c < 0 && d < 0)) {
        continue;
      }

      const intersections: Array<{ x: number; y: number }> = [];
      const addCrossing = (ex1: number, ey1: number, ev1: number, ex2: number, ey2: number, ev2: number) => {
        const crosses =
          (ev1 === 0 && ev2 !== 0) ||
          (ev2 === 0 && ev1 !== 0) ||
          (ev1 < 0 && ev2 > 0) ||
          (ev1 > 0 && ev2 < 0);
        if (!crosses) {
          return;
        }
        const point = interpolateZeroCrossing(ex1, ey1, ev1, ex2, ey2, ev2);
        if (point) {
          intersections.push(point);
        }
      };
      addCrossing(x0, y0, a, x1, y0, b);
      addCrossing(x1, y0, b, x1, y1, c);
      addCrossing(x1, y1, c, x0, y1, d);
      addCrossing(x0, y1, d, x0, y0, a);
      if (intersections.length === 4) {
        // Saddle cells have two possible pairings. Evaluate the field at
        // their center instead of always connecting the same edges.
        const horizontal = ((x0 + x1) / 2 - width / 2) / dc.scale + dc.centerX;
        const vertical = -((y0 + y1) / 2 - height / 2) / dc.scale + dc.centerY;
        const center = evaluate(horizontal, vertical);
        if (center === null || !Number.isFinite(center)) continue;
        const pairs = (center >= 0) === (a >= 0) ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
        for (const [start, end] of pairs) {
          drawSegment(intersections[start], intersections[end]);
        }
      } else if (intersections.length >= 2) {
        drawSegment(intersections[0], intersections[1]);
      }
    }
  }
  contourPaths.set(evaluate, { key, points: new Float32Array(points) });
}
