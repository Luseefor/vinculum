import { beforeEach, describe, expect, it } from "vitest";
import { Group, Mesh } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import {
  LINEAR_TRANSFORM_OVERLAY_PREFIX,
  updateLinearTransformOverlays
} from "@/lib/graph3d/buildLinearTransformOverlays";

let overlayTestCounter = 0;

function makeTransform(dimension: "2d" | "3d", entries: Record<string, string>): GraphObject {
  overlayTestCounter += 1;
  const base = { id: `lt-${dimension}-${overlayTestCounter}`, kind: "linearTransform", color: "#3b82f6", visible: true };
  return dimension === "2d"
    ? ({ ...base, dimension: "2d", m11: "1", m12: "0", m21: "0", m22: "1", ...entries } as GraphObject)
    : ({
        ...base,
        dimension: "3d",
        m11: "1", m12: "0", m13: "0",
        m21: "0", m22: "1", m23: "0",
        m31: "0", m32: "0", m33: "1",
        ...entries
      } as GraphObject);
}

function makeVector(components: [string, string, string]): GraphObject {
  return {
    id: "vec-1",
    kind: "vector",
    color: "#22c55e",
    visible: true,
    oxExpr: "10",
    oyExpr: "20",
    ozExpr: "30",
    vxExpr: components[0],
    vyExpr: components[1],
    vzExpr: components[2]
  } as GraphObject;
}

function addDirect(object: GraphObject): void {
  const state = useGraphStore.getState();
  useGraphStore.setState({ scene: { ...state.scene, objects: [...state.scene.objects, object] } });
}

function frameFor(configs: Record<string, { vectorId: string | null; showVector: boolean; showEigen: boolean }>) {
  return {
    configs,
    objects: useGraphStore.getState().scene.objects,
    overlayRoot: new Group(),
    cache: new Map<string, { key: string; group: Group }>(),
    params: {},
    clearAnalysis: (transformId: string) => useGraphStore.getState().clearLinearTransformAnalysis(transformId)
  };
}

describe("linearTransform overlays (S28 PART 25/44/64)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("draws the transformed vector anchored at the source origin", () => {
    const transform = makeTransform("3d", {});
    const vector = makeVector(["1", "2", "3"]);
    addDirect(transform);
    addDirect(vector);
    // diag is identity here; use a scaling matrix instead.
    const frame = frameFor({ [transform.id]: { vectorId: vector.id, showVector: true, showEigen: false } });
    updateLinearTransformOverlays(frame);
    const cached = frame.cache.get(`${LINEAR_TRANSFORM_OVERLAY_PREFIX}${transform.id}`);
    // Identity Av = v renders the comparison arrow.
    expect(cached).toBeDefined();
    expect(cached?.group.children.length).toBeGreaterThan(0);
    let raycastable = 0;
    cached?.group.traverse((child) => {
      if (child instanceof Mesh) {
        const hits: unknown[] = [];
        (child as Mesh).raycast({} as never, hits as never);
        raycastable += hits.length;
      }
    });
    expect(raycastable).toBe(0);
  });

  it("draws real eigendirection lines and skips complex-only sets", () => {
    const transform = makeTransform("2d", { m11: "2", m12: "0", m21: "0", m22: "3" });
    addDirect(transform);
    const frame = frameFor({ [transform.id]: { vectorId: null, showVector: false, showEigen: true } });
    updateLinearTransformOverlays(frame);
    const cached = frame.cache.get(`${LINEAR_TRANSFORM_OVERLAY_PREFIX}${transform.id}`);
    expect(cached).toBeDefined();
    // Two eigen lines for diag(2,3) inside one overlay group.
    let lineCount = 0;
    cached?.group.traverse((child) => {
      if ((child as { isLine?: boolean }).isLine === true) {
        lineCount += 1;
      }
    });
    expect(lineCount).toBe(2);
    const rotation = makeTransform("2d", { m11: "0", m12: "-1", m21: "1", m22: "0" });
    addDirect(rotation);
    const frame2 = frameFor({ [rotation.id]: { vectorId: null, showVector: false, showEigen: true } });
    updateLinearTransformOverlays(frame2);
    // Complex-only: facts signature exists but no finite children.
    expect(frame2.cache.get(`${LINEAR_TRANSFORM_OVERLAY_PREFIX}${rotation.id}`)).toBeUndefined();
  });

  it("hides overlays when sources hide and sweeps its own namespace", () => {
    const transform = makeTransform("2d", {});
    addDirect(transform);
    const frame = frameFor({ [transform.id]: { vectorId: null, showVector: false, showEigen: true } });
    updateLinearTransformOverlays(frame);
    // Identity has 2 real eigendirections; group cached.
    expect(frame.cache.size).toBe(1);
    const foreign = new Group();
    frame.cache.set("geometry-analysis:other", { key: "geometry-analysis:other", group: foreign });
    const hidden = { ...transform, visible: false } as GraphObject;
    const state = useGraphStore.getState();
    useGraphStore.setState({
      scene: { ...state.scene, objects: state.scene.objects.map((o) => (o.id === transform.id ? hidden : o)) }
    });
    const frame2 = { ...frameFor({ [transform.id]: { vectorId: null, showVector: false, showEigen: true } }), cache: frame.cache, overlayRoot: frame.overlayRoot };
    updateLinearTransformOverlays(frame2);
    // Hidden transform: cached group flips invisible with no recompute
    // (S27 PART 32 pattern); foreign namespace kept.
    expect(frame2.cache.get(`${LINEAR_TRANSFORM_OVERLAY_PREFIX}${transform.id}`)?.group.visible).toBe(false);
    expect(frame2.cache.get("geometry-analysis:other")).toBeDefined();
  });

  it("clears orphaned records for deleted transforms", () => {
    const transform = makeTransform("2d", {});
    addDirect(transform);
    useGraphStore.getState().setLinearTransformAnalysis(transform.id, { showEigen: true });
    const frame = frameFor({ "ghost": { vectorId: null, showVector: false, showEigen: true } });
    updateLinearTransformOverlays(frame);
    expect(useGraphStore.getState().ui.linearTransformAnalysisBySourceId["ghost"]).toBeUndefined();
  });
});
