import { beforeEach, expect, it, vi } from "vitest";
import { BufferGeometry, Group, Line, LineBasicMaterial, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { createGraphThreeEngineInputHandlers, type GraphThreeEngineInputHandlersDeps } from "@/lib/graph3d/graphThreeEngineInputHandlers";
import { useGraphStore } from "@/store/graphStore";

beforeEach(() => {
  useGraphStore.getState().resetScene();
  useGraphStore.getState().setCanvas3dTool("draw");
});

function fixture() {
  const geometry = new BufferGeometry();
  const material = new LineBasicMaterial();
  const line = new Line(geometry, material);
  line.visible = true;
  const deps: GraphThreeEngineInputHandlersDeps = {
    mutable: {
      isSketching: true, sketchPoints: Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0, z: i * 2 })),
      hoverProbePoint: { x: 1, y: 0, z: 2 }, analysisPickDown: { x: 1, y: 2 }, primitivePickDown: { x: 3, y: 4 }
    },
    tickRuntime: { baselinePlaneMode: 0 } as GraphThreeEngineInputHandlersDeps["tickRuntime"],
    renderer: { domElement: document.createElement("canvas") } as GraphThreeEngineInputHandlersDeps["renderer"],
    camera: new PerspectiveCamera(), raycaster: new Raycaster(), ndc: new Vector2(),
    objectsRoot: new Group(), baselinePlane: new Plane(), tempGround: new Vector3(),
    probeMarkerMeshes: [], sketchGeometry: geometry, sketchLine: line,
    maybeSnapPoint: point => point, formatProbe: () => "", setHoverProbeBadge: vi.fn()
  };
  const handlers = createGraphThreeEngineInputHandlers(deps);
  return { deps, handlers, cleanup: () => { geometry.dispose(); material.dispose(); } };
}

it.each(["Escape", "pointercancel"] as const)("cancels a 3D sketch on %s without saving a curve on later pointerup", action => {
  const { deps, handlers, cleanup } = fixture();
  if (action === "Escape") handlers.handleKeyDown(new KeyboardEvent("keydown", { key: "Escape" }));
  else handlers.handlePointerCancel();
  expect(deps.mutable.isSketching).toBe(false);
  expect(deps.mutable.sketchPoints).toEqual([]);
  expect(deps.mutable.analysisPickDown).toBeNull();
  expect(deps.mutable.primitivePickDown).toBeNull();
  expect(deps.mutable.hoverProbePoint).toBeNull();
  expect(deps.sketchLine.visible).toBe(false);
  handlers.handlePointerMove({ clientX: 50, clientY: 50 } as PointerEvent);
  handlers.handlePointerUp();
  expect(useGraphStore.getState().scene.objects).toHaveLength(0);
  cleanup();
});

it("still creates a curve from a completed 3D sketch", () => {
  const { handlers, cleanup } = fixture();
  handlers.handlePointerUp();
  expect(useGraphStore.getState().scene.objects).toHaveLength(1);
  expect(useGraphStore.getState().scene.objects[0].kind).toBe("parametricCurve");
  cleanup();
});
