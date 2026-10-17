import { describe, expect, it } from "vitest";
import { Group, PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import type { VectorObject } from "@vinculum/scene/types";
import { buildVectorPrimitive } from "@/lib/graph3d/buildGraphGeometryPrimitives";
import { pickGeometryPrimitiveAtPointer } from "@/lib/graph3d/graphThreePrimitivePick";

function vector(): VectorObject {
  return {
    id: "vec-1",
    kind: "vector",
    color: "#3b82f6",
    visible: true,
    oxExpr: "0",
    oyExpr: "0",
    ozExpr: "0",
    vxExpr: "2",
    vyExpr: "0",
    vzExpr: "0"
  };
}

function pickSetup() {
  const objectsRoot = new Group();
  const node = buildVectorPrimitive(vector());
  expect(node).not.toBeNull();
  objectsRoot.add(node!);
  objectsRoot.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(48, 1, 0.1, 30000);
  camera.position.set(6, 6, 6);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const rect = { left: 0, top: 0, width: 800, height: 800 };
  const renderer = { domElement: { getBoundingClientRect: () => rect } };
  return { objectsRoot, camera, raycaster, ndc, renderer, rect };
}

function clientForWorld(point: Vector3, camera: PerspectiveCamera, rect: { width: number; height: number }) {
  const projected = point.clone().project(camera);
  return {
    clientX: ((projected.x + 1) / 2) * rect.width,
    clientY: ((-projected.y + 1) / 2) * rect.height
  };
}

describe("primitive picking (S26 PART 23/45)", () => {
  it("selects the vector through its proxy shaft", () => {
    const { objectsRoot, camera, raycaster, ndc, renderer } = pickSetup();
    // World midpoint of the shaft: math (1,0,0) -> world (1,0,0).
    const event = clientForWorld(new Vector3(1, 0, 0), camera, { width: 800, height: 800 });
    const id = pickGeometryPrimitiveAtPointer(event, {
      renderer: renderer as never,
      camera,
      raycaster,
      ndc,
      objectsRoot,
      baselinePlane: undefined as never,
      tempGround: new Vector3(),
      pickOverride: null
    });
    expect(id).toBe("vec-1");
  });

  it("misses empty space without touching selection", () => {
    const { objectsRoot, camera, raycaster, ndc, renderer } = pickSetup();
    const id = pickGeometryPrimitiveAtPointer(
      { clientX: 790, clientY: 790 },
      {
        renderer: renderer as never,
        camera,
        raycaster,
        ndc,
        objectsRoot,
        baselinePlane: undefined as never,
        tempGround: new Vector3(),
        pickOverride: null
      }
    );
    expect(id).toBeNull();
  });

  it("returns null with no primitives and rejects degenerate rects", () => {
    const { camera, raycaster, ndc, renderer } = pickSetup();
    const empty = new Group();
    expect(
      pickGeometryPrimitiveAtPointer(
        { clientX: 400, clientY: 400 },
        {
          renderer: renderer as never,
          camera,
          raycaster,
          ndc,
          objectsRoot: empty,
          baselinePlane: undefined as never,
          tempGround: new Vector3(),
          pickOverride: null
        }
      )
    ).toBeNull();
    const zeroRect = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) } };
    expect(
      pickGeometryPrimitiveAtPointer(
        { clientX: 0, clientY: 0 },
        {
          renderer: zeroRect as never,
          camera,
          raycaster,
          ndc,
          objectsRoot: empty,
          baselinePlane: undefined as never,
          tempGround: new Vector3(),
          pickOverride: null
        }
      )
    ).toBeNull();
  });
});

describe("S31 empty-space deselect (Part DESELECT)", () => {
  function depsFor(objectsRoot: Group, camera: PerspectiveCamera, raycaster: Raycaster, ndc: Vector2, renderer: unknown) {
    return {
      mutable: {
        isSketching: false,
        hoverProbePoint: null,
        sketchPoints: [],
        analysisPickDown: null,
        primitivePickDown: null
      },
      tickRuntime: {},
      renderer,
      camera,
      raycaster,
      ndc,
      objectsRoot,
      baselinePlane: undefined,
      tempGround: new Vector3(),
      probeMarkerMeshes: [],
      sketchGeometry: undefined,
      sketchLine: undefined,
      maybeSnapPoint: (p: { x: number; y: number; z: number }) => p,
      formatProbe: () => "",
      setHoverProbeBadge: () => undefined
    };
  }

  it("deselects on a genuine clean miss and preserves on overlay hits", async () => {
    const { attemptPrimitivePick } = await import("@/lib/graph3d/graphThreeEngineInputPointer");
    const { pickHitsAnyVisibleObject } = await import("@/lib/graph3d/graphThreePrimitivePick");
    const { useGraphStore } = await import("@/store/graphStore");
    useGraphStore.getState().resetScene();
    const store = useGraphStore.getState();
    const id = store.addVectorObject();
    store.selectObject(id);

    const objectsRoot = new Group();
    const node = buildVectorPrimitive({ ...vector(), id });
    expect(node).not.toBeNull();
    objectsRoot.add(node!);
    objectsRoot.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(48, 1, 0.1, 30000);
    camera.position.set(6, 6, 6);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }) } };
    const args = {
      renderer: renderer as never,
      camera,
      raycaster,
      ndc,
      objectsRoot,
      baselinePlane: undefined as never,
      tempGround: new Vector3(),
      pickOverride: null
    };

    // A click on the shaft selects (proxy hit).
    const hit = clientForWorld(new Vector3(1, 0, 0), camera, { width: 800, height: 800 });
    expect(pickHitsAnyVisibleObject(hit, args)).toBe(true);
    // Empty corner hits nothing at all.
    expect(pickHitsAnyVisibleObject({ clientX: 790, clientY: 790 }, args)).toBe(false);

    const deps = depsFor(objectsRoot, camera, raycaster, ndc, renderer);
    attemptPrimitivePick(deps as never, { clientX: 790, clientY: 790 });
    expect(useGraphStore.getState().ui.selectedObjectId).toBeNull();

    // Re-select, then hide the node: hidden content does not block deselect.
    store.selectObject(id);
    node!.visible = false;
    attemptPrimitivePick(deps as never, { clientX: 790, clientY: 790 });
    expect(useGraphStore.getState().ui.selectedObjectId).toBeNull();
  });

  it("deselectObject clears selection without touching scene or history", async () => {
    const { useGraphStore } = await import("@/store/graphStore");
    const { useHistoryStore } = await import("@/lib/store/historyStore");
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
    const store = useGraphStore.getState();
    const id = store.addPointObject();
    store.selectObject(id);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
    const objectsBefore = useGraphStore.getState().scene.objects.length;
    const pastBefore = useHistoryStore.getState().past.length;
    useGraphStore.getState().deselectObject();
    expect(useGraphStore.getState().ui.selectedObjectId).toBeNull();
    expect(useGraphStore.getState().scene.objects.length).toBe(objectsBefore);
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);
    // No-op when nothing selected.
    useGraphStore.getState().deselectObject();
    expect(useGraphStore.getState().ui.selectedObjectId).toBeNull();
  });
});
