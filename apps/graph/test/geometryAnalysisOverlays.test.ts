import { beforeEach, describe, expect, it } from "vitest";
import { Group, Mesh } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import {
  GEOMETRY_ANALYSIS_OVERLAY_PREFIX,
  updateGeometryAnalysisOverlays
} from "@/lib/graph3d/buildGeometryAnalysisOverlays";

let testObjectCounter = 0;

function makeObject(kind: string, fields: Record<string, unknown>): GraphObject {
  testObjectCounter += 1;
  return { id: `${kind}-${testObjectCounter}`, kind, color: "#3b82f6", visible: true, ...fields } as GraphObject;
}

const POINT = (x: string, y: string, z: string): GraphObject =>
  makeObject("point", { xExpr: x, yExpr: y, zExpr: z });
const LINE = (p: [string, string, string], d: [string, string, string]): GraphObject =>
  makeObject("line", { pxExpr: p[0], pyExpr: p[1], pzExpr: p[2], dxExpr: d[0], dyExpr: d[1], dzExpr: d[2] });
const PLANE = (equation: string): GraphObject =>
  makeObject("plane", { equation, size: 12, appearance: { wireframe: false } });

function frameFor(configs: Record<string, { secondaryId: string; showOverlay: boolean }>) {
  const objects = useGraphStore.getState().scene.objects;
  return {
    configs,
    objects,
    overlayRoot: new Group(),
    cache: new Map<string, { key: string; group: Group }>(),
    params: {},
    halfExtent: 120,
    clearAnalysis: (primaryId: string) => useGraphStore.getState().clearGeometryAnalysis(primaryId)
  };
}

function addDirect(object: GraphObject): void {
  const state = useGraphStore.getState();
  const next = [...state.scene.objects, object];
  useGraphStore.setState({ scene: { ...state.scene, objects: next } });
}

describe("geometry analysis overlay sync (S27 PART 23/46)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("builds projection markers plus connectors with raycast disabled", () => {
    const point = POINT("3", "4", "0");
    const line = LINE(["0", "0", "0"], ["2", "0", "0"]);
    addDirect(point);
    addDirect(line);
    const frame = frameFor({ [point.id]: { secondaryId: line.id, showOverlay: true } });
    updateGeometryAnalysisOverlays(frame);
    const key = `${GEOMETRY_ANALYSIS_OVERLAY_PREFIX}${point.id}`;
    const cached = frame.cache.get(key);
    expect(cached).toBeDefined();
    // Marker + connector = 2 nodes (PART 45).
    expect(cached?.group.children).toHaveLength(2);
    expect(cached?.group.visible).toBe(true);
    // PART 44: no overlay child raycasts (never blocks selection/probing).
    let raycastable = 0;
    cached?.group.traverse((child) => {
      if (child instanceof Mesh) {
        const hits: unknown[] = [];
        (child as Mesh).raycast({} as never, hits as never);
        raycastable += hits.length;
      }
    });
    expect(raycastable).toBe(0);
    expect(frame.overlayRoot.children).toHaveLength(1);
  });

  it("hides overlays when a source hides, without recomputation", () => {
    const point = POINT("3", "4", "0");
    const line = LINE(["0", "0", "0"], ["2", "0", "0"]);
    addDirect(point);
    addDirect({ ...line, visible: false });
    const frame = frameFor({ [point.id]: { secondaryId: line.id, showOverlay: true } });
    updateGeometryAnalysisOverlays(frame);
    const key = `${GEOMETRY_ANALYSIS_OVERLAY_PREFIX}${point.id}`;
    // Hidden source: no overlay group built at all.
    expect(frame.cache.get(key)).toBeUndefined();
  });

  it("sweeps only its own namespace and clears orphaned records", () => {
    const point = POINT("1", "2", "3");
    addDirect(point);
    const frame = frameFor({ [point.id]: { secondaryId: "ghost", showOverlay: true } });
    // Foreign-namespace entry must survive the sweep (PART 46).
    const foreign = new Group();
    frame.cache.set("streamline:other", { key: "streamline:other", group: foreign });
    frame.overlayRoot.add(foreign);
    updateGeometryAnalysisOverlays(frame);
    expect(frame.cache.get("streamline:other")).toBeDefined();
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[point.id]).toBeUndefined();
  });

  it("draws ray overlaps as display lines with disarmed raycast", () => {
    const line = LINE(["0", "0", "0"], ["1", "0", "0"]);
    const rayObj = makeObject("ray", {
      oxExpr: "2",
      oyExpr: "0",
      ozExpr: "0",
      dxExpr: "1",
      dyExpr: "0",
      dzExpr: "0"
    });
    addDirect(line);
    addDirect(rayObj);
    const frame = frameFor({ [line.id]: { secondaryId: rayObj.id, showOverlay: true } });
    updateGeometryAnalysisOverlays(frame);
    const key = `${GEOMETRY_ANALYSIS_OVERLAY_PREFIX}${line.id}`;
    const cached = frame.cache.get(key);
    expect(cached).toBeDefined();
    const lines = (cached?.group.children ?? []).filter((child) => (child as { isLine?: boolean }).isLine === true || child.userData.wideStroke === true);
    expect(lines.length).toBeGreaterThan(0);
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

  it("renders plane-plane intersection lines through the shared clip path", () => {    const p1 = PLANE("x = 0");
    const p2 = PLANE("y = 0");
    addDirect(p1);
    addDirect(p2);
    const frame = frameFor({ [p1.id]: { secondaryId: p2.id, showOverlay: true } });
    updateGeometryAnalysisOverlays(frame);
    const key = `${GEOMETRY_ANALYSIS_OVERLAY_PREFIX}${p1.id}`;
    const cached = frame.cache.get(key);
    expect(cached).toBeDefined();
    // Line allocated in place on first refresh (PART 26).
    const lines = (cached?.group.children ?? []).filter((child) => (child as { isLine?: boolean }).isLine === true || child.userData.wideStroke === true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("keeps numeric results while overlay stays off by default", () => {
    const point = POINT("1", "3", "7");
    const plane = PLANE("z = 2");
    addDirect(point);
    addDirect(plane);
    useGraphStore.getState().setGeometryAnalysis(point.id, { secondaryId: plane.id });
    const frame = frameFor({ [point.id]: { secondaryId: plane.id, showOverlay: false } });
    updateGeometryAnalysisOverlays(frame);
    // Toggle off: no group, but the analysis record (and its numbers)
    // remain for the Inspector.
    expect(frame.cache.size).toBe(0);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[point.id]).toBeDefined();
  });
});

describe("geometry analysis lifecycle (S27 PART 32)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("sets, patches, and clears configs with same-value no-ops", () => {
    const store = useGraphStore.getState();
    const a = store.addPointObject();
    const b = store.addLineObject();
    store.setGeometryAnalysis(a, { secondaryId: b });
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]?.secondaryId).toBe(b);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]?.showOverlay).toBe(false);
    const before = useGraphStore.getState().ui.geometryAnalysisBySourceId;
    store.setGeometryAnalysis(a, { secondaryId: b });
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId).toBe(before);
    store.setGeometryAnalysis(a, { showOverlay: true });
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]?.showOverlay).toBe(true);
    store.clearGeometryAnalysis(a);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]).toBeUndefined();
  });

  it("prunes primary and secondary references on delete", () => {
    const store = useGraphStore.getState();
    const a = store.addPointObject();
    const b = store.addLineObject();
    store.setGeometryAnalysis(a, { secondaryId: b });
    store.removeObject(b);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]).toBeUndefined();
    const c = store.addPointObject();
    const d = store.addLineObject();
    store.setGeometryAnalysis(c, { secondaryId: d });
    store.removeObject(c);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[c]).toBeUndefined();
  });

  it("clears on kind switch, scene replace, and never persists", () => {
    const store = useGraphStore.getState();
    const a = store.addPointObject();
    const b = store.addLineObject();
    store.setGeometryAnalysis(a, { secondaryId: b });
    store.setObjectKind(b, "plane");
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId[a]).toBeUndefined();
    const c = store.addPointObject();
    const d = store.addLineObject();
    store.setGeometryAnalysis(c, { secondaryId: d });
    const depth = useHistoryStore.getState().past.length;
    store.setGeometryAnalysis(c, { showOverlay: true });
    expect(useHistoryStore.getState().past.length).toBe(depth);
    // Analysis never reaches the canonical document or its JSON.
    expect(JSON.stringify(useGraphStore.getState().scene)).not.toContain("eometryAnalysis");
    // Import-replace (deserialize path), not just empty reset.
    const next = {
      ...useGraphStore.getState().scene,
      objects: useGraphStore.getState().scene.objects.filter((o) => o.id !== d)
    };
    store.replaceSceneDocument(next);
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId).toEqual({});
    store.resetScene();
    expect(useGraphStore.getState().ui.geometryAnalysisBySourceId).toEqual({});
  });
});
