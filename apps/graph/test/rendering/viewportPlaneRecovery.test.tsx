import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { useGraph2dCanvasInteraction, type UseGraph2dCanvasInteractionArgs } from "@/components/graph/graph2d/useGraph2dCanvasInteraction";
import { Graph2DCanvasUiTopIdentity } from "@/components/graph/graph2d/Graph2DCanvasUiTopIdentity";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { Graph2DCanvasUiSketchFitPreview } from "@/components/graph/graph2d/Graph2DCanvasUiSketchFitPreview";

beforeEach(() => {
  const store = useGraphStore.getState();
  store.resetScene();
  store.setWorkspace("math");
  store.setActive2dViewport("primary");
  useEditorStore.getState().setViewportMode("quad");
});

function setupInteraction(tool: "draw" | "pan" = "draw") {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 }) as DOMRect;
  const captured = new Set<number>();
  canvas.setPointerCapture = vi.fn(id => { captured.add(id); });
  canvas.hasPointerCapture = vi.fn(id => captured.has(id));
  canvas.releasePointerCapture = vi.fn(id => { captured.delete(id); });
  const args: UseGraph2dCanvasInteractionArgs = {
    canvasRef: { current: canvas }, isQuadTop: false, canvas2dTool: tool,
    viewport: { centerX: 0, centerY: 0, scale: 40 }, pairForCanvas: "xy",
    snapEnabled: false, snapStep: 1, probePins: [],
    sketchAutoCreate: false, patchViewport2D: vi.fn(), setActive2dViewport: vi.fn(),
    setProbePinnedMath: vi.fn(), removeProbePin: vi.fn(), clearProbes: vi.fn(),
    addSketchedParametricFromStroke: vi.fn(() => "curve")
  };
  const hook = renderHook((props: UseGraph2dCanvasInteractionArgs) => useGraph2dCanvasInteraction(props), { initialProps: args });
  const event = (x: number, y: number) => ({ currentTarget: canvas, pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y }) as ReactPointerEvent<HTMLCanvasElement>;
  const draw = () => act(() => {
    hook.result.current.canvasHandlers.onPointerDown(event(100, 150));
    for (let i = 1; i <= 5; i++) hook.result.current.canvasHandlers.onPointerMove(event(100 + 10 * i, 150 - 5 * i));
  });
  return { ...hook, args, canvas, event, draw };
}

it.each(["plane", "hidden", "tool"] as const)("cancels a captured sketch when the %s changes", change => {
  const hook = setupInteraction();
  hook.draw();
  expect(hook.result.current.sketchDraft).toHaveLength(6);
  hook.rerender({ ...hook.args, ...(change === "plane" ? { pairForCanvas: "xz" as const } : change === "hidden" ? { suspended: true } : { canvas2dTool: "pan" as const }) });
  expect(hook.result.current.sketchDraft).toBeNull();
  expect(hook.canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  act(() => hook.result.current.canvasHandlers.onPointerUp(hook.event(150, 125)));
  expect(hook.result.current.sketchFitPreview).toBeNull();
  expect(hook.args.addSketchedParametricFromStroke).not.toHaveBeenCalled();
});

it.each(["plane", "hidden"] as const)("clears a completed fit preview when the pane is %s", change => {
  const hook = setupInteraction();
  hook.draw();
  act(() => hook.result.current.canvasHandlers.onPointerUp(hook.event(150, 125)));
  expect(hook.result.current.sketchFitPreview).not.toBeNull();
  hook.rerender({ ...hook.args, ...(change === "plane" ? { pairForCanvas: "yz" as const } : { suspended: true }) });
  expect(hook.result.current.sketchFitPreview).toBeNull();
});

it("does not resume a hidden pan on a later pointer move", () => {
  const hook = setupInteraction("pan");
  act(() => hook.result.current.canvasHandlers.onPointerDown(hook.event(100, 150)));
  hook.rerender({ ...hook.args, suspended: true });
  hook.rerender(hook.args);
  act(() => hook.result.current.canvasHandlers.onPointerMove(hook.event(200, 150)));
  expect(hook.args.patchViewport2D).not.toHaveBeenCalled();
});

it.each([false, true])("recovers planar objects in the originating pane (quadTop=%s)", isQuadTop => {
  const store = useGraphStore.getState();
  store.addLinearTransformObject("2d");
  store.setAxis2DPair("yz");
  store.setActive2dViewport("quadTop");
  store.setAxis2DPair("xz");
  // Deliberately focus the other pane before using the notice.
  store.setActive2dViewport(isQuadTop ? "primary" : "quadTop");
  const before = serializeScene(useGraphStore.getState().scene);
  const beforeViewport = useGraphStore.getState().ui.viewport2d;
  render(<Graph2DCanvasUiTopIdentity pairForCanvas={isQuadTop ? "xz" : "yz"} canvas2dTool="pan" isQuadTop={isQuadTop} />);
  fireEvent.click(screen.getByRole("button", { name: "Show on XY" }));
  const state = useGraphStore.getState();
  expect(state.ui.active2dViewport).toBe(isQuadTop ? "quadTop" : "primary");
  expect(isQuadTop ? state.ui.axis2dPairQuadTop : state.ui.axis2dPair).toBe("xy");
  expect(isQuadTop ? state.ui.axis2dPair : state.ui.axis2dPairQuadTop).toBe(isQuadTop ? "yz" : "xz");
  expect(useEditorStore.getState().viewportMode).toBe("quad");
  expect(state.ui.viewport2d).toEqual(beforeViewport);
  expect(serializeScene(state.scene)).toBe(before);
});

it("hides XY recovery when the plane already shows planar objects", () => {
  useGraphStore.getState().addLinearTransformObject("2d");
  render(<Graph2DCanvasUiTopIdentity pairForCanvas="xy" canvas2dTool="pan" />);
  expect(screen.queryByRole("button", { name: "Show on XY" })).toBeNull();
});

it.each(["xy", "xz", "yz"] as const)("auto-creates sketches on the originating %s plane", pairForCanvas => {
  const hook = setupInteraction();
  hook.rerender({ ...hook.args, pairForCanvas, sketchAutoCreate: true });
  hook.draw();
  act(() => hook.result.current.canvasHandlers.onPointerUp(hook.event(150, 125)));
  expect(hook.args.addSketchedParametricFromStroke).toHaveBeenCalledWith(expect.any(Array), pairForCanvas);
});

it("keeps a preview's XY coordinates after another pane becomes active", () => {
  const store = useGraphStore.getState();
  store.setActive2dViewport("primary");
  store.setAxis2DPair("xy");
  const hook = setupInteraction();
  hook.draw();
  act(() => hook.result.current.canvasHandlers.onPointerUp(hook.event(150, 125)));
  const preview = hook.result.current.sketchFitPreview!;
  store.setActive2dViewport("quadTop");
  store.setAxis2DPair("xz");
  render(<Graph2DCanvasUiSketchFitPreview
    axisPair={getAxisPairSpec("xy")} pairForCanvas="xy"
    sketchFitPreview={preview} setSketchFitPreview={vi.fn()}
    addSketchedParametricFromStroke={store.addSketchedParametricFromStroke}
  />);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  const object = useGraphStore.getState().scene.objects[0];
  expect(object.kind).toBe("parametricCurve");
  if (object.kind !== "parametricCurve") throw new Error("Expected fitted curve");
  expect(object.zExpr).toBe("0");
  expect(object.yExpr).not.toBe("0");
});
