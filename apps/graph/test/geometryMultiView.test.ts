import { describe, expect, it, vi } from "vitest";
import { Group, PerspectiveCamera, Scene } from "three";
import {
  cancelGeometryMultiViewDrag,
  containerPointFromClient,
  createGeometryMultiViewState,
  multiViewPickContext,
  multiViewPointerDown,
  multiViewPointerMove,
  multiViewPointerUp,
  multiViewWheel,
  renderGeometryMultiViewPanes,
  resetActiveGeometryView,
  routeAndActivateGeometryView,
  routeMultiViewPointer,
  setActiveGeometryView,
  setGeometryMultiViewPanes,
  type MultiViewRenderDeps
} from "@/lib/graph3d/graphThreeGeometryMultiView";
import { DEFAULT_ORTHO_SPAN } from "@/lib/graph3d/graphThreeOrthoViews";

/**
 * S16 synchronized views: routing, gesture isolation, and the shared-scene
 * render loop. Containers are fakes (no DOM/GL); cameras are real three.js
 * objects (pure math, no GL resources).
 */
function fakeContainer(width: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 10, top: 20, width, height }),
    clientWidth: width,
    clientHeight: height
  } as unknown as HTMLElement;
}

describe("setGeometryMultiViewPanes", () => {
  it("rejects untileable lengths (0, 3, 5) and keeps the prior state", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    // Untileable lengths are rejected at runtime (valid element types).
    setGeometryMultiViewPanes(state, ["perspective", "xy", "xz"]);
    expect(state.panes).toEqual(["perspective", "xy"]);
    setGeometryMultiViewPanes(state, ["perspective", "xy", "xz", "yz", "xy"]);
    expect(state.panes).toEqual(["perspective", "xy"]);
    setGeometryMultiViewPanes(state, []);
    expect(state.panes).toEqual(["perspective", "xy"]);
  });

  it("rejects invalid view values so the frame loop can never index garbage", () => {
    const state = createGeometryMultiViewState();
    // @ts-expect-error corrupted persisted value is rejected at runtime
    setGeometryMultiViewPanes(state, ["perspective", "foo"]);
    expect(state.panes).toBeNull();
  });

  it("accepts single/split/quad and falls back active to panes[0]", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    expect(state.activeView).toBe("perspective");
    setGeometryMultiViewPanes(state, ["xy", "xz"]);
    expect(state.panes).toEqual(["xy", "xz"]);
    expect(state.activeView).toBe("xy");
    // Active view already present is preserved.
    setGeometryMultiViewPanes(state, ["xz", "xy", "yz", "perspective"]);
    expect(state.activeView).toBe("xy");
  });

  it("null resets to legacy perspective and drops any drag", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    multiViewPointerDown(state, container, { clientX: 1090, clientY: 470, button: 0 }, "pan");
    expect(state.drag).not.toBeNull();
    setGeometryMultiViewPanes(state, null);
    expect(state.panes).toBeNull();
    expect(state.activeView).toBe("perspective");
    expect(state.drag).toBeNull();
  });

  it("setActiveGeometryView ignores views outside the current panes", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    setActiveGeometryView(state, "yz");
    expect(state.activeView).toBe("perspective");
    setActiveGeometryView(state, "xy");
    expect(state.activeView).toBe("xy");
  });

  it("resetActiveGeometryView resets the active ortho pane, not perspective", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    setActiveGeometryView(state, "xy");
    state.ortho.zoomByFactor("xy", 3);
    resetActiveGeometryView(state, () => {
      throw new Error("perspective reset must not run for an ortho pane");
    });
    expect(state.ortho.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
  });
});

describe("routeMultiViewPointer in split", () => {
  it("maps every corner, edge, divider, and out-of-area point (1440x900)", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const cases: Array<[number, number, string]> = [
      [0, 0, "perspective"],
      [719, 0, "perspective"],
      [0, 899, "perspective"],
      [719, 899, "perspective"],
      [360, 450, "perspective"],
      // Divider belongs to the right pane deterministically.
      [720, 0, "xy"],
      [720, 450, "xy"],
      [720, 899, "xy"],
      [721, 450, "xy"],
      [1439, 0, "xy"],
      [1439, 899, "xy"],
      [1080, 450, "xy"],
      // Out-of-area clamps to the nearest pane.
      [-50, -50, "perspective"],
      [-50, 950, "perspective"],
      [2000, 2000, "xy"],
      [2000, -100, "xy"]
    ];
    for (const [x, y, expected] of cases) {
      expect(routeMultiViewPointer(state, 1440, 900, x, y)).toBe(expected);
    }
    // Routing records the pane active.
    routeMultiViewPointer(state, 1440, 900, 1080, 450);
    expect(state.activeView).toBe("xy");
  });
});

describe("routeMultiViewPointer in quad", () => {
  it("maps all four quadrants, dividers, and far out-of-area points", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy", "xz", "yz"]);
    const cases: Array<[number, number, string]> = [
      [0, 0, "perspective"],
      [719, 449, "perspective"],
      [1439, 0, "xy"],
      [721, 449, "xy"],
      [0, 899, "xz"],
      [719, 450, "xz"],
      [1439, 899, "yz"],
      [721, 899, "yz"],
      // Shared dividers: right/bottom pane wins deterministically.
      [720, 449, "xy"],
      [719, 450, "xz"],
      [720, 450, "yz"],
      [-1000, -1000, "perspective"],
      [3000, 3000, "yz"]
    ];
    for (const [x, y, expected] of cases) {
      expect(routeMultiViewPointer(state, 1440, 900, x, y)).toBe(expected);
    }
  });
});

describe("routeAndActivateGeometryView + containerPointFromClient", () => {
  it("translates client coordinates and rejects degenerate containers", () => {
    expect(containerPointFromClient({ left: 10, top: 20 }, 30, 50)).toEqual({ x: 20, y: 30 });
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    // Container at (10,20): client (1090,470) is container-relative (1080,450).
    expect(routeAndActivateGeometryView(state, fakeContainer(1440, 900), 1090, 470)).toBe("xy");
    expect(state.activeView).toBe("xy");
    expect(routeAndActivateGeometryView(state, fakeContainer(0, 0), 1090, 470)).toBeNull();
    const legacy = createGeometryMultiViewState();
    expect(routeAndActivateGeometryView(legacy, fakeContainer(1440, 900), 1090, 470)).toBeNull();
  });
});

describe("ortho grab-drag gesture isolation", () => {
  it("starts a drag on ortho panes, pans by exact world-per-pixel, and never touches the perspective camera", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const perspectiveCamera = new PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    perspectiveCamera.position.set(7, -9, 6);
    perspectiveCamera.lookAt(0, 0, 0);
    const before = {
      aspect: perspectiveCamera.aspect,
      position: perspectiveCamera.position.clone(),
      quaternion: perspectiveCamera.quaternion.clone()
    };
    // Orient the ortho camera exactly as the render loop would.
    state.ortho.updateFrustum("xy", { left: 720, top: 0, width: 720, height: 900 });

    const started = multiViewPointerDown(
      state,
      container,
      { clientX: 1090, clientY: 470, button: 0 },
      "pan"
    );
    expect(started).toBe(true);
    expect(state.drag?.view).toBe("xy");
    expect(state.activeView).toBe("xy");

    // Drag +72px right, +90px down inside the 720x900 pane:
    // worldPerPixel = span / min(720, 900) = 12/720; xy camera right is +x
    // and up is +z, so center moves (-1.2, 0, +1.5).
    multiViewPointerMove(state, container, { clientX: 1162, clientY: 560 });
    const center = state.ortho.getState("xy").center;
    expect(center.x).toBeCloseTo(-1.2, 9);
    expect(center.y).toBeCloseTo(0, 12);
    expect(center.z).toBeCloseTo(1.5, 9);

    multiViewPointerUp(state);
    expect(state.drag).toBeNull();

    expect(perspectiveCamera.aspect).toBe(before.aspect);
    expect(perspectiveCamera.position.equals(before.position)).toBe(true);
    expect(perspectiveCamera.quaternion.equals(before.quaternion)).toBe(true);
  });

  it("refuses drags on perspective, with draw tool, with non-left buttons, and in legacy mode", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    // Perspective pane: no drag.
    expect(
      multiViewPointerDown(state, container, { clientX: 370, clientY: 470, button: 0 }, "pan")
    ).toBe(false);
    expect(state.drag).toBeNull();
    // Draw tool reserves the drag for sketching.
    expect(
      multiViewPointerDown(state, container, { clientX: 1090, clientY: 470, button: 0 }, "draw")
    ).toBe(false);
    expect(state.drag).toBeNull();
    // Right button: no drag.
    expect(
      multiViewPointerDown(state, container, { clientX: 1090, clientY: 470, button: 2 }, "pan")
    ).toBe(false);
    expect(state.drag).toBeNull();
    // Legacy mode: disabled.
    const legacy = createGeometryMultiViewState();
    expect(
      multiViewPointerDown(legacy, container, { clientX: 1090, clientY: 470, button: 0 }, "pan")
    ).toBe(false);
  });

  it("move without a drag is a no-op and cancel/up drop the drag", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const before = state.ortho.getState("xy").center.clone();
    multiViewPointerMove(state, container, { clientX: 1200, clientY: 600 });
    expect(state.ortho.getState("xy").center.equals(before)).toBe(true);
    multiViewPointerDown(state, container, { clientX: 1090, clientY: 470, button: 0 }, "pan");
    cancelGeometryMultiViewDrag(state);
    expect(state.drag).toBeNull();
    multiViewPointerMove(state, container, { clientX: 1200, clientY: 600 });
    expect(state.ortho.getState("xy").center.equals(before)).toBe(true);
  });
});

describe("multiViewWheel", () => {
  it("zooms the ortho pane under the pointer with exact exponential factor", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    // Pixel deltas: factor = exp(240 * 0.0012).
    const consumed = multiViewWheel(state, container, {
      clientX: 1090,
      clientY: 470,
      deltaY: 240,
      deltaMode: 0
    });
    expect(consumed).toBe(true);
    expect(state.ortho.getState("xy").span).toBeCloseTo(12 * Math.exp(240 * 0.0012), 12);
    expect(state.activeView).toBe("xy");
    expect(state.ortho.getState("xz").span).toBe(DEFAULT_ORTHO_SPAN);
  });

  it("converts line deltas to pixels (x16) before zooming", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const consumed = multiViewWheel(state, container, {
      clientX: 1090,
      clientY: 470,
      deltaY: 10,
      deltaMode: 1
    });
    expect(consumed).toBe(true);
    expect(state.ortho.getState("xy").span).toBeCloseTo(12 * Math.exp(10 * 16 * 0.0012), 12);
  });

  it("ignores perspective panes, zero/NaN deltas, and legacy mode", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    expect(
      multiViewWheel(state, container, { clientX: 370, clientY: 470, deltaY: 240, deltaMode: 0 })
    ).toBe(false);
    expect(state.activeView).toBe("perspective");
    expect(
      multiViewWheel(state, container, { clientX: 1090, clientY: 470, deltaY: 0, deltaMode: 0 })
    ).toBe(false);
    expect(
      multiViewWheel(state, container, {
        clientX: 1090,
        clientY: 470,
        deltaY: Number.NaN,
        deltaMode: 0
      })
    ).toBe(false);
    expect(state.ortho.getState("xy").span).toBe(DEFAULT_ORTHO_SPAN);
    const legacy = createGeometryMultiViewState();
    expect(
      multiViewWheel(legacy, container, { clientX: 1090, clientY: 470, deltaY: 240, deltaMode: 0 })
    ).toBe(false);
  });
});

describe("multiViewPickContext", () => {
  it("returns pane-scoped contexts with the right camera per pane", () => {
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const perspectiveCamera = new PerspectiveCamera();
    const orthoPane = multiViewPickContext(state, perspectiveCamera, container, 1090, 470);
    expect(orthoPane).not.toBeNull();
    expect(orthoPane?.camera).toBe(state.ortho.getCamera("xy"));
    expect(orthoPane?.rect).toEqual({ left: 730, top: 20, width: 720, height: 900 });
    const perspectivePane = multiViewPickContext(state, perspectiveCamera, container, 370, 470);
    expect(perspectivePane?.camera).toBe(perspectiveCamera);
    expect(perspectivePane?.rect).toEqual({ left: 10, top: 20, width: 720, height: 900 });
    const legacy = createGeometryMultiViewState();
    expect(multiViewPickContext(legacy, perspectiveCamera, container, 1090, 470)).toBeNull();
  });
});

describe("renderGeometryMultiViewPanes shared-scene loop", () => {
  function mockDeps(container: HTMLElement) {
    const renderer = {
      getSize: vi.fn((target) => target.set(container.clientWidth, container.clientHeight)),
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      setScissorTest: vi.fn(),
      render: vi.fn()
    };
    const labelRenderer = {
      domElement: { style: {} as Record<string, string> },
      setSize: vi.fn(),
      render: vi.fn()
    };
    const scene = new Scene();
    const perspectiveCamera = new PerspectiveCamera(50, 1, 0.1, 1000);
    const labelGroup = new Group();
    return {
      renderer,
      labelRenderer,
      scene,
      perspectiveCamera,
      container,
      labelGroup
    } as unknown as MultiViewRenderDeps & { renderer: typeof renderer } & {
      labelRenderer: typeof labelRenderer;
    };
  }

  it("renders every pane from the SAME scene with per-pane aspect and matching scissors", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const deps = mockDeps(fakeContainer(1440, 900));
    renderGeometryMultiViewPanes(state, deps);

    // One scene object shared by both draws.
    expect(deps.renderer.render).toHaveBeenCalledTimes(2);
    const [first, second] = deps.renderer.render.mock.calls;
    expect(first[0]).toBe(deps.scene);
    expect(first[1]).toBe(deps.perspectiveCamera);
    expect(second[0]).toBe(deps.scene);
    expect(second[1]).toBe(state.ortho.getCamera("xy"));

    // S16-R1: half-width pane gets its own aspect, not the container's.
    expect(deps.perspectiveCamera.aspect).toBeCloseTo(720 / 900, 12);

    // Both split panes span the full container height.
    expect(deps.renderer.setViewport.mock.calls).toEqual([
      [0, 0, 720, 900],
      [720, 0, 720, 900]
    ]);
    expect(deps.renderer.setScissor.mock.calls).toEqual([
      [0, 0, 720, 900],
      [720, 0, 720, 900]
    ]);
    expect(deps.renderer.setScissorTest.mock.calls).toEqual([[true], [false]]);

    // S16-R4: label layer clipped to the perspective pane.
    expect(deps.labelGroup.visible).toBe(true);
    expect(deps.labelRenderer.domElement.style.display).toBe("block");
    expect(deps.labelRenderer.domElement.style.left).toBe("0px");
    expect(deps.labelRenderer.domElement.style.top).toBe("0px");
    expect(deps.labelRenderer.setSize).toHaveBeenCalledWith(720, 900);
    expect(deps.labelRenderer.render).toHaveBeenCalledTimes(1);
    expect(deps.labelRenderer.render.mock.calls[0][0]).toBe(deps.scene);
  });

  it("bounds Quad scissors to the renderer while layout and buffer resize are out of sync", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy", "xz", "yz"]);
    const deps = mockDeps(fakeContainer(1440, 900));
    deps.renderer.getSize.mockImplementation(target => target.set(390, 658));
    renderGeometryMultiViewPanes(state, deps);
    expect(deps.renderer.setScissor.mock.calls).toEqual([
      [0, 0, 195, 329], [195, 0, 195, 329], [0, 329, 195, 329], [195, 329, 195, 329]
    ]);
  });

  it("keeps quad cameras in the same top-left rectangles as labels and pointer routing", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy", "xz", "yz"]);
    const deps = mockDeps(fakeContainer(1441, 901));
    renderGeometryMultiViewPanes(state, deps);
    const expected = [[0, 0, 720, 450], [720, 0, 721, 450], [0, 450, 720, 451], [720, 450, 721, 451]];
    expect(deps.renderer.setViewport.mock.calls).toEqual(expected);
    expect(deps.renderer.setScissor.mock.calls).toEqual(expected);
    expect(deps.renderer.render.mock.calls.map(call => call[1])).toEqual([
      deps.perspectiveCamera, state.ortho.getCamera("xy"), state.ortho.getCamera("xz"), state.ortho.getCamera("yz")
    ]);
    expect(deps.labelRenderer.domElement.style.top).toBe("0px");
  });

  it("offsets the label layer for a non-leading perspective pane and hides it without one", () => {
    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["xy", "perspective"]);
    const deps = mockDeps(fakeContainer(1440, 900));
    renderGeometryMultiViewPanes(state, deps);
    expect(deps.labelRenderer.domElement.style.left).toBe("720px");
    expect(deps.labelRenderer.setSize).toHaveBeenCalledWith(720, 900);

    const single = createGeometryMultiViewState();
    setGeometryMultiViewPanes(single, ["xy"]);
    const singleDeps = mockDeps(fakeContainer(1440, 900));
    renderGeometryMultiViewPanes(single, singleDeps);
    expect(singleDeps.renderer.render).toHaveBeenCalledTimes(1);
    expect(singleDeps.renderer.render.mock.calls[0][0]).toBe(singleDeps.scene);
    expect(singleDeps.renderer.render.mock.calls[0][1]).toBe(single.ortho.getCamera("xy"));
    expect(singleDeps.labelGroup.visible).toBe(false);
    expect(singleDeps.labelRenderer.domElement.style.display).toBe("none");
    expect(singleDeps.labelRenderer.render).not.toHaveBeenCalled();
  });

  it("draws nothing for legacy mode or degenerate containers", () => {
    const legacy = createGeometryMultiViewState();
    const legacyDeps = mockDeps(fakeContainer(1440, 900));
    renderGeometryMultiViewPanes(legacy, legacyDeps);
    expect(legacyDeps.renderer.render).not.toHaveBeenCalled();

    const state = createGeometryMultiViewState();
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    const zeroDeps = mockDeps(fakeContainer(0, 0));
    renderGeometryMultiViewPanes(state, zeroDeps);
    expect(zeroDeps.renderer.render).not.toHaveBeenCalled();
  });
});

describe("S34 touch pinch (ortho zoom + pan)", () => {
  it("two pointers pinch-zoom toward their midpoint without jumping", async () => {
    const { multiViewPointerDown: down } = await import("@/lib/graph3d/graphThreeGeometryMultiView");
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    state.ortho.updateFrustum("xy", { left: 720, top: 0, width: 720, height: 900 });
    const spanBefore = state.ortho.getState("xy").span;
    // First finger starts a pan; second finger converts it to a pinch.
    expect(down(state, container, { clientX: 1000, clientY: 450, button: 0, pointerId: 1, pointerType: "touch" }, "pan")).toBe(true);
    expect(down(state, container, { clientX: 1180, clientY: 450, button: 0, pointerId: 2, pointerType: "touch" }, "pan")).toBe(true);
    expect(state.drag).toBeNull();
    expect(state.pinch?.view).toBe("xy");
    expect(state.pinch?.distance).toBeCloseTo(180, 9);
    // Spread fingers apart (180 → 260): zooms in (span shrinks), no jump.
    const { multiViewPointerMove: move } = await import("@/lib/graph3d/graphThreeGeometryMultiView");
    move(state, container, { clientX: 960, clientY: 450, pointerId: 1 });
    move(state, container, { clientX: 1220, clientY: 450, pointerId: 2 });
    const spanAfter = state.ortho.getState("xy").span;
    expect(spanAfter).toBeLessThan(spanBefore);
    expect(spanAfter).toBeCloseTo(spanBefore * (180 / 260), 6);
    // Lifting one finger ends the pinch without resuming a pan.
    const { multiViewPointerUp: up } = await import("@/lib/graph3d/graphThreeGeometryMultiView");
    up(state, 2);
    expect(state.pinch).toBeNull();
    expect(state.drag).toBeNull();
    move(state, container, { clientX: 900, clientY: 450, pointerId: 1 });
    expect(state.ortho.getState("xy").span).toBeCloseTo(spanAfter, 9);
  });

  it("pinch midpoint pan tracks fingers", async () => {
    const mod = await import("@/lib/graph3d/graphThreeGeometryMultiView");
    const state = createGeometryMultiViewState();
    const container = fakeContainer(1440, 900);
    setGeometryMultiViewPanes(state, ["perspective", "xy"]);
    state.ortho.updateFrustum("xy", { left: 720, top: 0, width: 720, height: 900 });
    mod.multiViewPointerDown(state, container, { clientX: 1000, clientY: 450, button: 0, pointerId: 1, pointerType: "touch" }, "pan");
    mod.multiViewPointerDown(state, container, { clientX: 1180, clientY: 450, button: 0, pointerId: 2, pointerType: "touch" }, "pan");
    const centerBefore = state.ortho.getState("xy").center.clone();
    // Both fingers slide right 72px at constant spread: pure pan, no zoom.
    mod.multiViewPointerMove(state, container, { clientX: 1072, clientY: 450, pointerId: 1 });
    mod.multiViewPointerMove(state, container, { clientX: 1252, clientY: 450, pointerId: 2 });
    const center = state.ortho.getState("xy").center;
    expect(state.ortho.getState("xy").span).toBeCloseTo(12, 9);
    // worldPerPixel = 12/720; content follows fingers: center moves -72*wpp in x.
    expect(center.x).toBeCloseTo(centerBefore.x - 72 * (12 / 720), 6);
  });
});
