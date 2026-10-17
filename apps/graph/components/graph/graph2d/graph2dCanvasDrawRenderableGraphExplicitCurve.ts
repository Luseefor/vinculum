import {
  CURVE_EDGE_OVERSCAN_PX,
  CURVE_MAX_SAMPLES,
  CURVE_MIN_SAMPLES,
  CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
  CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR,
  CURVE_VERTICAL_BREAK_MIN_PX,
  CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR
} from "./graph2dCanvasConstants";
import { clamp } from "./graph2dCanvasMath";
import type { ViewportTransform } from "./graph2dCanvasProbes";
import type { RenderableGraph } from "./graph2dCanvasTypes";
import { isContinuousSampleEdge } from "@/lib/math/curves/sampleContinuity";

const paths = new WeakMap<Function, Array<{ key: string; commands: Float64Array }>>();

export function drawGraph2dExplicitFunctionCurve(
  graph: RenderableGraph,
  dc: ViewportTransform,
  ctx: Pick<CanvasRenderingContext2D, "moveTo" | "lineTo" | "stroke">,
  width: number,
  height: number,
  scale: number,
  centerX: number,
  mathToScreen: (mathX: number, mathY: number, viewport: ViewportTransform) => { x: number; y: number }
): void {
  if (graph.swapAxes) {
    const swappedContext = {
      moveTo: (x: number, y: number) => ctx.moveTo(y, x),
      lineTo: (x: number, y: number) => ctx.lineTo(y, x),
      stroke: () => ctx.stroke()
    };
    drawGraph2dExplicitFunctionCurve({ ...graph, swapAxes: false }, dc, swappedContext, height, width, scale, dc.centerY,
      (input, output, viewport) => { const point = mathToScreen(output, input, viewport); return { x: point.y, y: point.x }; });
    return;
  }
  const transform = [mathToScreen(0, 0, dc), mathToScreen(1, 0, dc), mathToScreen(0, 1, dc)];
  const key = JSON.stringify([width, height, scale, centerX, dc.centerY, graph.hasDiscontinuities, transform]);
  const entries = paths.get(graph.evaluate!) ?? [];
  const cached = entries.find(entry => entry.key === key);
  if (cached) {
    for (let i = 0; i < cached.commands.length; i += 3) {
      if (cached.commands[i]) ctx.lineTo(cached.commands[i + 1], cached.commands[i + 2]);
      else ctx.moveTo(cached.commands[i + 1], cached.commands[i + 2]);
    }
    ctx.stroke();
    return;
  }
  const commands: number[] = [];
  const edgeOverscanUnits = CURVE_EDGE_OVERSCAN_PX / scale;
  const verticalBreakPx = Math.max(CURVE_VERTICAL_BREAK_MIN_PX, height * CURVE_VERTICAL_BREAK_VIEWPORT_FACTOR);
  const verticalPaddingPx = Math.max(
    CURVE_OFFSCREEN_VERTICAL_PAD_MIN_PX,
    height * CURVE_OFFSCREEN_VERTICAL_PAD_VIEWPORT_FACTOR
  );

  const minHorizontal = centerX - width / (2 * scale) - edgeOverscanUnits;
  const maxHorizontal = centerX + width / (2 * scale) + edgeOverscanUnits;
  const sampleCount = clamp(
    Math.round((width + CURVE_EDGE_OVERSCAN_PX * 2) * 1.15),
    CURVE_MIN_SAMPLES,
    CURVE_MAX_SAMPLES
  );
  const horizontalSpan = maxHorizontal - minHorizontal;

  let isFirst = true;
  let lastScreenY: number | null = null;
  let previousHorizontal: number | null = null;
  let previousVertical = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const horizontal = minHorizontal + horizontalSpan * (index / sampleCount);
    const vertical = graph.evaluate!(horizontal);
    if (vertical === null || !Number.isFinite(vertical)) {
      isFirst = true;
      previousHorizontal = null;
      lastScreenY = null;
      continue;
    }

    const screen = mathToScreen(horizontal, vertical, dc);
    if (screen.y < -verticalPaddingPx || screen.y > height + verticalPaddingPx) {
      isFirst = true;
      previousHorizontal = null;
      lastScreenY = null;
      continue;
    }

    if (lastScreenY !== null && Math.abs(screen.y - lastScreenY) > verticalBreakPx) {
      isFirst = true;
    }
    if (previousHorizontal !== null && graph.hasDiscontinuities && !isContinuousSampleEdge(graph.evaluate!, previousHorizontal, horizontal, previousVertical, vertical)) isFirst = true;

    if (isFirst) {
      commands.push(0, screen.x, screen.y);
      ctx.moveTo(screen.x, screen.y);
      isFirst = false;
    } else {
      commands.push(1, screen.x, screen.y);
      ctx.lineTo(screen.x, screen.y);
    }

    lastScreenY = screen.y;
    previousHorizontal = horizontal;
    previousVertical = vertical;
  }

  ctx.stroke();
  entries.unshift({ key, commands: new Float64Array(commands) });
  paths.set(graph.evaluate!, entries.slice(0, 3));
}
