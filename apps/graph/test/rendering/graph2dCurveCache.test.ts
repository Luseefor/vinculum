import { expect, it, vi } from "vitest";
import { drawGraph2dExplicitFunctionCurve } from "@/components/graph/graph2d/graph2dCanvasDrawRenderableGraphExplicitCurve";
import { graph2dMathToScreen } from "@/components/graph/graph2d/graph2dCanvasTransforms";
import type { RenderableGraph } from "@/components/graph/graph2d/graph2dCanvasTypes";

it("replays explicit curve paths without reevaluation and invalidates for edits or viewport changes", () => {
  const evaluate = vi.fn((x: number) => Math.sin(x));
  const graph: RenderableGraph = { id: "s", color: "#123456", evaluate, implicitEvaluate: null, verticalLineValue: null, horizontalLineValue: null, hatchDomain: null, polylineHV: null };
  const viewport = { width: 400, height: 300, scale: 60, centerX: 0, centerY: 0 };
  const context = { moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
  const draw = (g = graph, dc = viewport) => drawGraph2dExplicitFunctionCurve(g, dc, context, dc.width, dc.height, dc.scale, dc.centerX, graph2dMathToScreen);
  draw();
  const count = evaluate.mock.calls.length, path = context.lineTo.mock.calls.slice();
  context.lineTo.mockClear();
  draw({ ...graph, color: "#654321" });
  expect(evaluate).toHaveBeenCalledTimes(count);
  expect(context.lineTo.mock.calls).toEqual(path);
  draw(graph, { ...viewport, scale: 120 });
  expect(evaluate.mock.calls.length).toBeGreaterThan(count);
  const changed = vi.fn((x: number) => Math.cos(x));
  draw({ ...graph, evaluate: changed });
  expect(changed).toHaveBeenCalled();
});
