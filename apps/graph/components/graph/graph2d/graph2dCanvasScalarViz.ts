import { resolveScalarRange, scalarColorForValue } from "@/lib/math/scalarColorPolicy";
import { vectorFieldCellSize } from "@/lib/math/vectorFieldGlyphs";
import type { ScalarVizResultBody } from "@/lib/compute/scalarVizResults";
import { drawVectorFieldArrows } from "./graph2dCanvasVectorField";
import type { DrawContext, ScalarFieldAttachment, VectorFieldArrows } from "./graph2dCanvasTypes";
import type { ViewportTransform } from "./graph2dCanvasProbes";

// S23 2D scalar-visualization draw layer (heat bitmaps, contour batches,
// gradient glyphs). Reads cached worker results; never samples, never
// requests — pan/zoom/theme changes only redraw. Heat bitmaps are cached
// per (source, signature, theme) offscreen and blitted with drawImage
// into the transformed domain rect (PART 22 option A: affine redraw, zero
// resampling). Contours stroke as one batch with a contrasting underlay
// plus theme ink, so they read on every heat color in both themes.
// Gradient glyphs reuse the S20 batched arrow renderer with the S20
// magnitude policy. Derived layers never intercept pointer events (the
// canvas keeps a single interactive surface).
//
// ScalarFieldAttachment lives canonically in graph2dCanvasTypes (with the
// RenderableGraph field); this module imports it.

interface BitmapCacheEntry {
  bitmap: HTMLCanvasElement;
  signature: string;
  theme: string;
}

const bitmapCache = new Map<string, BitmapCacheEntry>();
const BITMAP_CACHE_LIMIT = 8;

export function clearScalarBitmapCacheForTests(): void {
  bitmapCache.clear();
}

export function scalarBitmapCacheSizeForTests(): number {
  return bitmapCache.size;
}

function bitmapCacheKey(sourceId: string, signature: string, theme: string): string {
  return `${sourceId}::${signature}::${theme}`;
}

function storeBitmapCache(key: string, entry: BitmapCacheEntry): void {
  if (bitmapCache.has(key)) {
    bitmapCache.delete(key);
  }
  bitmapCache.set(key, entry);
  while (bitmapCache.size > BITMAP_CACHE_LIMIT) {
    const oldest = bitmapCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    bitmapCache.delete(oldest);
  }
}

// Builds (or reuses) the heat bitmap for a result. Rows flip vertically:
// ImageData row 0 is the TOP row, while grid row 0 sits at vMin (math
// bottom). Invalid samples stay transparent (singularities read as gaps).
export function scalarHeatBitmap(
  sourceId: string,
  signature: string,
  theme: string,
  result: Extract<ScalarVizResultBody, { status: "ok" }>
): HTMLCanvasElement | null {
  const key = bitmapCacheKey(sourceId, signature, theme);
  const cached = bitmapCache.get(key);
  if (cached) {
    bitmapCache.delete(key);
    bitmapCache.set(key, cached);
    return cached.bitmap;
  }
  const range = resolveScalarRange(result.min, result.max, result.validCount);
  if (range.mode === "empty") {
    return null;
  }
  const bitmap = document.createElement("canvas");
  bitmap.width = result.width;
  bitmap.height = result.height;
  const ctx = bitmap.getContext("2d");
  if (!ctx) {
    return null;
  }
  const image = ctx.createImageData(result.width, result.height);
  const data = image.data;
  for (let j = 0; j < result.height; j += 1) {
    const destRow = result.height - 1 - j;
    for (let i = 0; i < result.width; i += 1) {
      const srcIndex = j * result.width + i;
      const destIndex = (destRow * result.width + i) * 4;
      if (result.valid[srcIndex] === 0) {
        data[destIndex + 3] = 0;
        continue;
      }
      const [r, g, b, a] = scalarColorForValue(result.values[srcIndex] as number, range);
      data[destIndex] = r;
      data[destIndex + 1] = g;
      data[destIndex + 2] = b;
      data[destIndex + 3] = a;
    }
  }
  ctx.putImageData(image, 0, 0);
  storeBitmapCache(key, { bitmap, signature, theme });
  return bitmap;
}

export function drawScalarHeatLayer(
  attachments: { attachment: ScalarFieldAttachment; signature: string; result: Extract<ScalarVizResultBody, { status: "ok" }> }[],
  theme: string,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  const { ctx } = dc;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const { attachment, signature, result } of attachments) {
    const bitmap = scalarHeatBitmap(attachment.sourceId, signature, theme, result);
    if (!bitmap) {
      continue;
    }
    // Destination rect from the domain corners (axis-aligned in math, so
    // two corners suffice; min/max guards inverted ranges).
    const topLeft = mathToScreen(attachment.domain.uMin, attachment.domain.vMax, dc);
    const bottomRight = mathToScreen(attachment.domain.uMax, attachment.domain.vMin, dc);
    const left = Math.min(topLeft.x, bottomRight.x);
    const top = Math.min(topLeft.y, bottomRight.y);
    const width = Math.abs(bottomRight.x - topLeft.x);
    const height = Math.abs(bottomRight.y - topLeft.y);
    if (!(width >= 1 && height >= 1)) {
      continue;
    }
    ctx.drawImage(bitmap, left, top, width, height);
  }
  ctx.restore();
}

// Strokes contour segments (grid-math coords) in one batch. Underlay
// first (contrasting ink, wide, translucent), then theme ink thin —
// O(1) canvas state changes however many segments exist.
export function drawScalarContours(
  segments: ArrayLike<number>,
  segmentCount: number,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number },
  theme: string
): void {
  if (segmentCount <= 0) {
    return;
  }
  const { ctx } = dc;
  const ink = theme === "dark" ? "#f1f5f9" : "#0f172a";
  const underlay = theme === "dark" ? "rgba(15, 23, 42, 0.55)" : "rgba(255, 255, 255, 0.6)";
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dc.width, dc.height);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [strokeStyle, lineWidth] of [
    [underlay, 2.5],
    [ink, 1]
  ] as const) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let s = 0; s < segmentCount; s += 1) {
      const x0 = segments[s * 4] as number;
      const y0 = segments[s * 4 + 1] as number;
      const x1 = segments[s * 4 + 2] as number;
      const y1 = segments[s * 4 + 3] as number;
      const a = mathToScreen(x0, y0, dc);
      const b = mathToScreen(x1, y1, dc);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Shapes worker gradient samples into the S20 arrow struct. Positions are
// (u, v) in the source independent variables; the attach site guarantees
// the canvas pair matches, so no projection is needed (unlike S20 vector
// fields, which project arbitrary pairs).
export function buildScalarGradientArrows(
  result: Extract<ScalarVizResultBody, { status: "ok" }>,
  domain: { uMin: number; uMax: number; vMin: number; vMax: number },
  density: number,
  scale: number,
  normalize: boolean
): VectorFieldArrows | null {
  if (result.gradientValidCount <= 0 || result.gradientStatus !== "ok") {
    return null;
  }
  const count = result.gradientValidCount;
  const bases = new Float64Array(count * 2);
  const directions = new Float64Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    bases[i * 2] = result.gradientPositions[i * 3] as number;
    bases[i * 2 + 1] = result.gradientPositions[i * 3 + 1] as number;
    const gx = result.gradientVectors[i * 3] as number;
    const gy = result.gradientVectors[i * 3 + 1] as number;
    const length = Math.sqrt(gx * gx + gy * gy);
    if (length > 0 && Number.isFinite(length)) {
      directions[i * 2] = gx / length;
      directions[i * 2 + 1] = gy / length;
    }
  }
  return {
    bases,
    directions,
    magnitudes: result.gradientMagnitudes,
    count,
    maxMagnitude: result.gradientMaxMagnitude,
    cell: vectorFieldCellSize(
      { xMin: domain.uMin, xMax: domain.uMax, yMin: domain.vMin, yMax: domain.vMax },
      density,
      "2d"
    ),
    scale,
    normalize
  };
}

export function drawScalarGradientField(
  arrows: VectorFieldArrows,
  color: string,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  drawVectorFieldArrows(arrows, color, dc, mathToScreen);
}
