// S33 canvas-guard gaps: multi-pointer ownership (M1/R5), tool-hotkey
// suppression mid-drag (R10), hidden handle visibility (R9), and hover
// emphasis weaker-than-selection with exact restore. UI-only, no engine math.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Plane, Raycaster, SphereGeometry, Vector2, Vector3 } from "three";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import {
  beginDragTransaction,
  cancelDragTransaction,
  isDragTransactionActive,
  resetDragTransactionForTests,
} from "@/lib/interaction/dragHistoryTransaction";

// Stub the shared S21 ray setup (always succeeds) and the handle pick so the
// multi-pointer test controls exactly which press starts a drag without
// depending on camera NDC math. Anchor resolution stays real (compiler).
vi.mock("@/lib/graph3d/graphThreeEnginePickWorld", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/graph3d/graphThreeEnginePickWorld")>();
  return { ...original, setPickRaycaster: () => true };
});

vi.mock("@/lib/graph3d/graphThreeInteractionHandles", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/graph3d/graphThreeInteractionHandles")>();
  return {
    ...original,
    pickInteractionHandle: vi.fn(),
  };
});

import { pickInteractionHandle } from "@/lib/graph3d/graphThreeInteractionHandles";
import { createCanvasInteraction } from "@/lib/graph3d/graphThreeCanvasInteraction";
import { GeometryOrthoController } from "@/lib/graph3d/graphThreeOrthoViews";
import {
  applyHoverEmphasisToNode,
  applySelectionEmphasisToNode,
} from "@/lib/graph3d/buildGraphObjectDisposal";
import {
  countInteractionHandleNamespaces,
  syncInteractionHandles,
} from "@/lib/graph3d/graphThreeInteractionHandles";

function resetAll() {
  resetDragTransactionForTests();
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
  vi.mocked(pickInteractionHandle).mockReset();
}

function addSelectedPoint(x = "0", y = "0", z = "0"): string {
  const store = useGraphStore.getState();
  const id = store.addPointObject();
  store.updateGeometryCoordinate(id, "xExpr", x);
  store.updateGeometryCoordinate(id, "yExpr", y);
  store.updateGeometryCoordinate(id, "zExpr", z);
  store.selectObject(id);
  store.setCanvas3dTool("pan");
  useHistoryStore.getState().clear();
  return id;
}

function pointExpressions(id: string): [string, string, string] {
  const object = useGraphStore.getState().scene.objects.find((candidate) => candidate.id === id);
  if (!object || object.kind !== "point") {
    throw new Error("point missing");
  }
  return [object.xExpr, object.yExpr, object.zExpr];
}

function makeInteraction(pointId: string) {
  const ortho = new GeometryOrthoController();
  const objectsRoot = new Group();
  const interactionRoot = new Group();
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } as unknown as HTMLElement;
  const domElement = {
    style: { cursor: "" },
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const renderer = { domElement } as unknown as import("three").WebGLRenderer;
  const camera = new PerspectiveCamera(48, 1, 0.1, 80000);
  const controls = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as import("three-stdlib").OrbitControls;
  const multiView = {
    activeView: "xy",
    panes: ["xy"],
    ortho,
  } as unknown as import("@/lib/graph3d/graphThreeGeometryMultiView").GeometryMultiViewState;
  const interaction = createCanvasInteraction({
    renderer,
    camera,
    controls,
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    objectsRoot,
    interactionRoot,
    objectNodes: new Map(),
    container,
    multiView,
    baselinePlane: new Plane(),
    tempGround: new Vector3(),
    getPickContext: () => null,
  });
  // The stubbed pick returns the point handle for every press attempt; the
  // second press is refused by the transaction guard, not by a pick miss.
  vi.mocked(pickInteractionHandle).mockReturnValue({ objectId: pointId, handle: "point" });
  return { interaction, ortho };
}

describe("S33 multi-pointer ownership (M1/R5)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("second press is ignored and only the owning pointer steers or commits", () => {
    const id = addSelectedPoint("0", "0", "0");
    const { interaction } = makeInteraction(id);

    expect(interaction.handlePointerDown({ clientX: 400, clientY: 300, button: 0, pointerId: 1 })).toBe(true);
    expect(interaction.isDragging()).toBe(true);
    expect(isDragTransactionActive()).toBe(true);

    // Second pointer press while dragging starts nothing.
    expect(interaction.handlePointerDown({ clientX: 410, clientY: 310, button: 0, pointerId: 2 })).toBe(false);
    expect(interaction.isDragging()).toBe(true);

    // Unrelated pointer moves are swallowed (no camera alongside) but must
    // not steer the drag: the point stays at the origin.
    expect(interaction.handlePointerMove({ clientX: 700, clientY: 100, pointerId: 2 })).toBe(true);
    expect(pointExpressions(id)[0]).toBe("0");

    // Owning pointer moves the point.
    expect(interaction.handlePointerMove({ clientX: 460, clientY: 300, pointerId: 1 })).toBe(true);
    expect(pointExpressions(id)[0]).not.toBe("0");

    // Releasing the second pointer must not commit someone else's drag.
    interaction.handlePointerUp({ clientX: 700, clientY: 100, pointerId: 2 });
    expect(interaction.isDragging()).toBe(true);
    expect(isDragTransactionActive()).toBe(true);

    // Owning pointer release commits exactly one undo entry.
    const movedX = pointExpressions(id)[0];
    interaction.handlePointerUp({ clientX: 460, clientY: 300, pointerId: 1 });
    expect(interaction.isDragging()).toBe(false);
    expect(isDragTransactionActive()).toBe(false);
    expect(useHistoryStore.getState().past.length).toBe(1);
    expect(pointExpressions(id)[0]).toBe(movedX);
    interaction.dispose();
  });
});

describe("S33 tool hotkeys ignored mid-drag (R10)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("mid-drag 1/2/3 leave the tool alone; after release they switch", async () => {
    const { createGraphThreeKeyboardAndContextHandlers } = await import(
      "@/lib/graph3d/graphThreeEngineInputKeysContext"
    );
    const handlers = createGraphThreeKeyboardAndContextHandlers({
      tickRuntime: { isAltDown: false } as never,
      renderer: { domElement: { getBoundingClientRect: () => ({ width: 800, height: 600 }) } } as never,
      ndc: { x: 0, y: 0 } as never,
      raycaster: { setFromCamera: vi.fn(), intersectObjects: () => [] } as never,
      camera: {} as never,
      probeMarkerMeshes: [],
      resolvePickContext: () => null,
      clearSketch: vi.fn(),
    });
    useGraphStore.getState().setCanvas3dTool("pan");
    const id = addSelectedPoint("0", "0", "0");
    expect(beginDragTransaction(id)).toBe(true);

    handlers.handleKeyDown({ key: "2", target: document.body } as unknown as KeyboardEvent);
    expect(useGraphStore.getState().ui.canvas3dTool).toBe("pan");
    handlers.handleKeyDown({ key: "3", target: document.body } as unknown as KeyboardEvent);
    expect(useGraphStore.getState().ui.canvas3dTool).toBe("pan");

    cancelDragTransaction();
    handlers.handleKeyDown({ key: "2", target: document.body } as unknown as KeyboardEvent);
    expect(useGraphStore.getState().ui.canvas3dTool).toBe("probe");
  });
});

describe("S33 hidden handles stay hidden (R9)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("hidden objects expose no visible markers or grab proxies", () => {
    const root = new Group();
    const hidden = {
      id: "p-hidden",
      kind: "point",
      color: "#fff",
      visible: false,
      xExpr: "1",
      yExpr: "2",
      zExpr: "3",
    } as never;
    syncInteractionHandles(root, hidden, ["point"]);
    expect(countInteractionHandleNamespaces(root)).toBe(1);
    const meshes: Mesh[] = [];
    root.traverse((child) => {
      if (child instanceof Mesh) {
        meshes.push(child);
      }
    });
    // Marker + proxy, both hidden.
    expect(meshes.length).toBe(2);
    for (const mesh of meshes) {
      expect(mesh.visible).toBe(false);
    }
  });
});

describe("S33 hover emphasis weaker than selection with exact restore", () => {
  it("hover brightens less than selection and restores the base color", () => {
    const node = new Group();
    const mesh = new Mesh(
      new SphereGeometry(0.1, 8, 8),
      new MeshBasicMaterial({ color: "#ff0000" })
    );
    node.add(mesh);
    const base = `#${(mesh.material as MeshBasicMaterial).color.getHexString()}`;

    applyHoverEmphasisToNode(node, true);
    const hovered = `#${(mesh.material as MeshBasicMaterial).color.getHexString()}`;
    expect(hovered).not.toBe(base);

    applyHoverEmphasisToNode(node, false);
    expect(`#${(mesh.material as MeshBasicMaterial).color.getHexString()}`).toBe(base);

    // Selection uses the same stash mechanism but a stronger brighten.
    applySelectionEmphasisToNode(node, true);
    const selected = `#${(mesh.material as MeshBasicMaterial).color.getHexString()}`;
    expect(selected).not.toBe(base);
    expect(selected).not.toBe(hovered);
    // Hover is visibly weaker: closer to the base color than selection is.
    const distance = (a: string, b: string) => {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
    };
    expect(distance(hovered, base)).toBeLessThan(distance(selected, base));
  });
});
