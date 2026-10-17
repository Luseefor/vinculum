import { expect, it, vi } from "vitest";
import { paintGraph2dCanvasFrame } from "@/components/graph/graph2d/graph2dCanvasPaintFrame";
import { graph2dPaintPalette } from "@/components/graph/graph2d/graph2dPaintPalette";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";

it("reuses the backing buffer on viewport redraws and reallocates only after resizing", () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
  try {
    const context = new Proxy({ measureText: () => ({ width: 10 }) }, {
      get: (target, key) => key in target ? Reflect.get(target, key) : vi.fn()
    }) as unknown as CanvasRenderingContext2D;
    let width = 0, height = 0, allocations = 0;
    const canvas = {
      get width() { return width; }, set width(value: number) { width = value; allocations++; },
      get height() { return height; }, set height(value: number) { height = value; allocations++; },
      style: { width: "", height: "" }, getContext: () => context
    } as unknown as HTMLCanvasElement;
    let containerWidth = 400.5;
    const container = { getBoundingClientRect: () => ({ width: containerWidth, height: 300.25 }) } as HTMLElement;
    const args: Parameters<typeof paintGraph2dCanvasFrame>[0] = {
      canvas, container, palette: graph2dPaintPalette("light"), theme: "light",
      viewport: { centerX: 0, centerY: 0, scale: 50 }, renderableGraphs: [],
      scalarResults: {}, scalarConfigs: {}, streamlineResults: {}, streamlineConfigs: {},
      canvas2dTool: "pan", mousePos: null, isQuadTop: false, probePins: [], measurements: [],
      selectedMeasurementId: null, pairForCanvas: "xy", axisPair: getAxisPairSpec("xy"), sketchDraft: null
    };
    paintGraph2dCanvasFrame(args);
    expect([canvas.width, canvas.height, allocations]).toEqual([801, 600, 2]);
    paintGraph2dCanvasFrame({ ...args, viewport: { centerX: 2, centerY: 1, scale: 80 } });
    expect(allocations).toBe(2);
    containerWidth = 500;
    paintGraph2dCanvasFrame(args);
    expect([canvas.width, canvas.height, allocations]).toEqual([1000, 600, 3]);
  } finally {
    if (descriptor) Object.defineProperty(window, "devicePixelRatio", descriptor);
  }
});
