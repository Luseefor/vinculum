import { describe, expect, it, vi } from "vitest";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { drawVectorFieldArrows } from "@/components/graph/graph2d/graph2dCanvasVectorField";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { graph2dMathToScreen } from "@/components/graph/graph2d/graph2dCanvasTransforms";
import type { VectorFieldArrows } from "@/components/graph/graph2d/graph2dCanvasTypes";
import { createDefaultVectorFieldGraph } from "@vinculum/scene/defaults";
import type { VectorFieldObject2D } from "@vinculum/scene/types";

function makeField2D(overrides: Omit<Partial<VectorFieldObject2D>, "dimension" | "kind"> = {}) {
  return {
    ...createDefaultVectorFieldGraph({ id: "vf-1", index: 0, dimension: "2d" }),
    ...overrides
  };
}

function stubContext() {
  return {
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn()
  };
}

const VIEWPORT = { width: 200, height: 200, centerX: 0, centerY: 0, scale: 50 };

describe("2D vector-field rendering (S20 Slice 5)", () => {
  it("builds pair-projected arrows for a 2D radial field", () => {
    const graphs = buildRenderableGraphsFromScene([makeField2D()], getAxisPairSpec("xy"), {});
    expect(graphs).toHaveLength(1);
    const arrows = graphs[0]?.vectorField;
    expect(arrows).toBeDefined();
    expect(arrows!.count).toBe(256);
    expect(arrows!.maxMagnitude).toBeCloseTo(Math.sqrt(50), 5);
    expect(arrows!.cell).toBeCloseTo(10 / 15, 12);
    // First sample at the domain corner (-5,-5), radial direction (1,1)/√2.
    expect(arrows!.bases[0]).toBe(-5);
    expect(arrows!.bases[1]).toBe(-5);
    const inv = 1 / Math.sqrt(2);
    expect(arrows!.directions[0]).toBeCloseTo(-inv, 6);
    expect(arrows!.directions[1]).toBeCloseTo(-inv, 6);
    expect(arrows!.scale).toBe(1);
    expect(arrows!.normalize).toBe(false);
  });

  it("component edits change the arrows; singular columns drop", () => {
    const radial = buildRenderableGraphsFromScene([makeField2D()], getAxisPairSpec("xy"), {});
    const rotation = buildRenderableGraphsFromScene(
      [makeField2D({ pExpr: "-y", qExpr: "x" })],
      getAxisPairSpec("xy"),
      {}
    );
    expect(Array.from(rotation[0]!.vectorField!.directions)).not.toEqual(
      Array.from(radial[0]!.vectorField!.directions)
    );

    const singular = buildRenderableGraphsFromScene(
      [
        makeField2D({
          pExpr: "1/x",
          qExpr: "y",
          domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1 },
          density: 5
        })
      ],
      getAxisPairSpec("xy"),
      {}
    );
    // 25 samples, x=0 column (5) invalid.
    expect(singular[0]?.vectorField?.count).toBe(20);
  });

  it("skips 3D fields, invalid math, and empty components without throwing", () => {
    const field3D = {
      ...createDefaultVectorFieldGraph({ id: "vf-3", index: 1, dimension: "3d" })
    };
    expect(buildRenderableGraphsFromScene([field3D], getAxisPairSpec("xy"), {})).toEqual([]);
    expect(
      buildRenderableGraphsFromScene([makeField2D({ pExpr: "zzz" })], getAxisPairSpec("xy"), {})
    ).toEqual([]);
    expect(
      buildRenderableGraphsFromScene([makeField2D({ pExpr: "", qExpr: "" })], getAxisPairSpec("xy"), {})
    ).toEqual([]);
    expect(
      buildRenderableGraphsFromScene([{ ...makeField2D(), visible: false }], getAxisPairSpec("xy"), {})
    ).toEqual([]);
  });

  it("threads explicit parameter snapshots into sampling (S20-R9)", () => {
    const field = makeField2D({ pExpr: "a*x", qExpr: "y" });
    const withA2 = buildRenderableGraphsFromScene([field], getAxisPairSpec("xy"), { a: 2 });
    const withA3 = buildRenderableGraphsFromScene([field], getAxisPairSpec("xy"), { a: 3 });
    expect(withA2).toHaveLength(1);
    expect(withA3).toHaveLength(1);
    // First sample at x=-5: P = a*x proves the snapshot reached sampling.
    expect(withA2[0]!.vectorField!.count).toBe(withA3[0]!.vectorField!.count);
    // Magnitudes scale with a: corner (5,5) gives sqrt(25a^2+25).
    expect(
      withA2[0]!.vectorField!.maxMagnitude / withA3[0]!.vectorField!.maxMagnitude
    ).toBeCloseTo(Math.sqrt(0.5), 5);
  });

  it("projects planar fields onto xz/yz pairs by component selection", () => {    const xz = buildRenderableGraphsFromScene([makeField2D()], getAxisPairSpec("xz"), {});
    const arrows = xz[0]?.vectorField;
    expect(arrows).toBeDefined();
    // Samples live at z=0: every base vertical is 0, every direction
    // vertical is 0 (Q collapses where the pair has no y axis).
    for (let i = 0; i < arrows!.count; i += 1) {
      expect(arrows!.bases[i * 2 + 1]).toBe(0);
      expect(arrows!.directions[i * 2 + 1]).toBe(0);
    }
    // Horizontal carries P over the x grid.
    expect(arrows!.bases[0]).toBe(-5);

    const yz = buildRenderableGraphsFromScene([makeField2D()], getAxisPairSpec("yz"), {});
    const yzArrows = yz[0]?.vectorField;
    expect(yzArrows).toBeDefined();
    // yz horizontal is the field's y axis: first base horizontal is -5.
    expect(yzArrows!.bases[0]).toBe(-5);
  });

  it("draws math-up arrows as screen-up (Y inversion)", () => {
    // Single arrow: base (1,0), math direction (0,1).
    const arrows: VectorFieldArrows = {
      bases: new Float64Array([1, 0]),
      directions: new Float64Array([0, 1]),
      magnitudes: new Float32Array([1]),
      count: 1,
      maxMagnitude: 1,
      cell: 1,
      scale: 1,
      normalize: false
    };
    const ctx = stubContext();
    drawVectorFieldArrows(arrows, "#3b82f6", { ...VIEWPORT, ctx: ctx as unknown as CanvasRenderingContext2D }, graph2dMathToScreen);
    // Shaft: moveTo(base) + lineTo(tip); head: 2 x (moveTo + lineTo).
    expect(ctx.moveTo).toHaveBeenCalledTimes(3);
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // Base (1,0) at scale 50 in a 200px box centered on origin: (150,100).
    expect(ctx.moveTo).toHaveBeenNthCalledWith(1, 150, 100);
    // Tip math (1,1) -> screen (150,50): above the base on screen.
    expect(ctx.lineTo).toHaveBeenNthCalledWith(1, 150, 50);
  });

  it("draws nothing for zero fields but keeps valid samples", () => {
    const arrows: VectorFieldArrows = {
      bases: new Float64Array([0, 0, 1, 1]),
      directions: new Float64Array([0, 0, 0, 0]),
      magnitudes: new Float32Array([0, 0]),
      count: 2,
      maxMagnitude: 0,
      cell: 1,
      scale: 1,
      normalize: false
    };
    const ctx = stubContext();
    drawVectorFieldArrows(arrows, "#3b82f6", { ...VIEWPORT, ctx: ctx as unknown as CanvasRenderingContext2D }, graph2dMathToScreen);
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });

  it("normalize mode draws equal screen lengths for unequal magnitudes", () => {
    const arrows: VectorFieldArrows = {
      bases: new Float64Array([0, 0, 2, 0]),
      directions: new Float64Array([1, 0, 1, 0]),
      magnitudes: new Float32Array([1, 2]),
      count: 2,
      maxMagnitude: 2,
      cell: 1,
      scale: 1,
      normalize: true
    };
    const ctx = stubContext();
    drawVectorFieldArrows(arrows, "#3b82f6", { ...VIEWPORT, ctx: ctx as unknown as CanvasRenderingContext2D }, graph2dMathToScreen);
    const [tip1x, tip1y] = ctx.lineTo.mock.calls[0] as [number, number];
    const [tip2x, tip2y] = ctx.lineTo.mock.calls[1] as [number, number];
    // Both tips exactly one cell (50px) right of their bases, same height.
    expect(tip1x).toBeCloseTo(150, 9);
    expect(tip2x).toBeCloseTo(250, 9);
    expect(tip1y).toBeCloseTo(100, 9);
    expect(tip2y).toBeCloseTo(100, 9);
  });
});
