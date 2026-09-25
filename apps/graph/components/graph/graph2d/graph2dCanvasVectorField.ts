import { computeVectorFieldData } from "@/lib/math/computeVectorFieldData";
import { computeGlyphLength, vectorFieldCellSize } from "@/lib/math/vectorFieldGlyphs";
import { projectMathToPair2D } from "@/lib/math/coordinates";
import type { VectorFieldObject2D } from "@vinculum/scene/types";
import type { AxisPairSpec, DrawContext, VectorFieldArrows } from "./graph2dCanvasTypes";
import type { ViewportTransform } from "./graph2dCanvasProbes";

// S20 2D vector-field rendering. Sampling is synchronous and bounded here
// (<= 32^2 = 1024 samples, microseconds of mathjs evaluation), matching the
// established 2D architecture where parametric polylines compile + sample
// inline in the renderable builder. Parameter snapshots arrive explicitly
// from the caller (S20-R9: no ambient store reads inside the builder). The
// worker path serves 3D only; 2D never enqueues compute jobs (pan/zoom/
// viewport changes cannot resample because the builder takes no viewport
// input — the useMemo deps in Graph2DCanvas are [objects, axisPair,
// paramScope]).
//
// Pair projection treats the 2D field as the planar field F(x,y,0) =
// <P,Q,0>: positions and direction deltas project through the same linear
// component selection (translation-free by construction, so reusing the
// point projection for deltas is exact). Under xy the field is direct;
// under xz/yz the arrows are the mathematically correct planar projection
// (Q collapses where the pair has no y axis).

export function buildVectorFieldArrows(
  object: VectorFieldObject2D,
  axisPair: AxisPairSpec,
  params: Record<string, number>
): VectorFieldArrows | null {
  const sampled = computeVectorFieldData({
    dimension: "2d",
    pExpr: object.pExpr,
    qExpr: object.qExpr,
    rExpr: "",
    domain: object.domain,
    density: object.density,
    params
  });
  if (sampled.status !== "ok") {
    return null;
  }
  const pair = axisPairKey(axisPair);
  const bases = new Float64Array(sampled.validCount * 2);
  const directions = new Float64Array(sampled.validCount * 2);
  for (let i = 0; i < sampled.validCount; i += 1) {
    const base = projectMathToPair2D(
      {
        x: sampled.positions[i * 3] as number,
        y: sampled.positions[i * 3 + 1] as number,
        z: 0
      },
      pair
    );
    const delta = projectMathToPair2D(
      {
        x: sampled.vectors[i * 3] as number,
        y: sampled.vectors[i * 3 + 1] as number,
        z: 0
      },
      pair
    );
    bases[i * 2] = base.horizontal;
    bases[i * 2 + 1] = base.vertical;
    const length = Math.sqrt(delta.horizontal * delta.horizontal + delta.vertical * delta.vertical);
    if (length > 0 && Number.isFinite(length)) {
      directions[i * 2] = delta.horizontal / length;
      directions[i * 2 + 1] = delta.vertical / length;
    }
  }
  return {
    bases,
    directions,
    magnitudes: sampled.magnitudes,
    count: sampled.validCount,
    maxMagnitude: sampled.maxMagnitude,
    cell: vectorFieldCellSize(object.domain, object.density, "2d"),
    scale: object.scale,
    normalize: object.normalize
  };
}

function axisPairKey(axisPair: AxisPairSpec): "xy" | "xz" | "yz" {
  const key = `${axisPair.horizontal}${axisPair.vertical}`;
  if (key === "xz" || key === "yz") {
    return key;
  }
  return "xy";
}

const ARROW_HEAD_ANGLE = (27 * Math.PI) / 180;
const ARROW_HEAD_MIN_PX = 3;
const ARROW_HEAD_MAX_PX = 9;

export interface ScreenArrowTip {
  x: number;
  y: number;
  angle: number;
  shaftPx: number;
}

// Shared screen-space arrowhead batch (S20 glyph heads + S24 streamline
// direction markers): two barbs per tip at ±27°, head size proportional
// to shaft length clamped to [3, 9] px. Caller owns path/style state;
// this appends one stroked batch.
export function drawScreenArrowheads(tips: ScreenArrowTip[], ctx: CanvasRenderingContext2D): void {
  if (tips.length === 0) {
    return;
  }
  ctx.beginPath();
  for (const tip of tips) {
    const headPx = Math.min(Math.max(0.35 * tip.shaftPx, ARROW_HEAD_MIN_PX), ARROW_HEAD_MAX_PX);
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - headPx * Math.cos(tip.angle - ARROW_HEAD_ANGLE),
      tip.y - headPx * Math.sin(tip.angle - ARROW_HEAD_ANGLE)
    );
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(
      tip.x - headPx * Math.cos(tip.angle + ARROW_HEAD_ANGLE),
      tip.y - headPx * Math.sin(tip.angle + ARROW_HEAD_ANGLE)
    );
  }
  ctx.stroke();
}

export function drawVectorFieldArrows(
  arrows: VectorFieldArrows,
  color: string,
  dc: DrawContext,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  const { ctx } = dc;
  // Two batched strokes (all shafts, then all heads): O(1) canvas state
  // changes regardless of glyph count. Lengths are math-unit policy
  // outputs mapped through the uniform viewport scale, so DPR never alters
  // mathematical length (the context is pre-scaled for DPR by the paint
  // frame; all units below are CSS pixels).
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  const tips: Array<{ x: number; y: number; angle: number; shaftPx: number }> = [];
  for (let i = 0; i < arrows.count; i += 1) {
    const dirX = arrows.directions[i * 2] as number;
    const dirY = arrows.directions[i * 2 + 1] as number;
    if (dirX === 0 && dirY === 0) {
      continue;
    }
    const length = computeGlyphLength(
      arrows.magnitudes[i] as number,
      arrows.maxMagnitude,
      arrows.cell,
      arrows.scale,
      arrows.normalize
    );
    if (!(length > 0)) {
      continue;
    }
    const base = mathToScreen(arrows.bases[i * 2] as number, arrows.bases[i * 2 + 1] as number, dc);
    const tip = mathToScreen(
      (arrows.bases[i * 2] as number) + dirX * length,
      (arrows.bases[i * 2 + 1] as number) + dirY * length,
      dc
    );
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(tip.x, tip.y);
    tips.push({ x: tip.x, y: tip.y, angle: Math.atan2(tip.y - base.y, tip.x - base.x), shaftPx: Math.hypot(tip.x - base.x, tip.y - base.y) });
  }
  ctx.stroke();

  drawScreenArrowheads(tips, ctx);
}
