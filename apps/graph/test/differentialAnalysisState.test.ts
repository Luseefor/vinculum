import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { analysisSourceIdentity, resolveAnalysisFreshness } from "@/store/graphStoreSliceAnalysis";

const POINT = { x: 1, y: 2, z: 9 };

describe("differential analysis state (S21 Slice 3)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("arms, sets, toggles, and clears analysis records", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.armDifferentialAnalysisPick(id);
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBe(id);

    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    const record = useGraphStore.getState().ui.differentialAnalysisBySourceId[id];
    expect(record).toMatchObject({ sourceId: id, point: POINT, structure: "dark::struct-1" });
    expect(record?.showNormal).toBe(true);
    expect(record?.showTangent).toBe(true);
    // Setting the point disarms the pick.
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();

    store.setDifferentialAnalysisOverlays(id, { showTangent: false });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]?.showTangent).toBe(false);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]?.showNormal).toBe(true);

    store.clearDifferentialAnalysis(id);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
  });

  it("equation, domain, and resolution edits clear attached analysis", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    store.updateSurfaceEquation(id, "z = x^2 + y^2");
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();

    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-2");
    store.updateSurfaceDomain(id, { xMax: 6 });
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();

    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-3");
    store.updateSurfaceResolution(id, 48);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
  });

  it("wireframe toggles retain analysis (appearance is not math identity)", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-4");
    store.toggleSurfaceWireframe(id);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeDefined();
  });

  it("color and visibility edits retain analysis", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    store.updateObjectColor(id, "#f59e0b");
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeDefined();
    store.toggleObjectVisibility(id);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeDefined();
  });

  it("delete, kind switch, replace, and reset prune analysis", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    store.armDifferentialAnalysisPick(id);

    store.setObjectKind(id, "implicitSurface");
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id]).toBeUndefined();
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();

    const id2 = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id2, POINT, "dark::struct-2");
    store.removeObject(id2);
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId[id2]).toBeUndefined();

    const id3 = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id3, POINT, "dark::struct-3");
    store.resetScene();
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId).toEqual({});
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();

    const id4 = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id4, POINT, "dark::struct-4");
    store.replaceSceneDocument(createSceneDocument({ objects: [] }));
    expect(useGraphStore.getState().ui.differentialAnalysisBySourceId).toEqual({});
  });

  it("resolves freshness: pending hides, mismatch clears, match shows", () => {    const record = {
      sourceId: "s",
      point: POINT,
      structure: "sig-A",
      showNormal: true,
      showTangent: true
    };
    expect(
      resolveAnalysisFreshness({ record, liveStructure: "sig-A", computeStatus: "idle" })
    ).toBe("current");
    expect(
      resolveAnalysisFreshness({ record, liveStructure: "sig-A", computeStatus: "pending" })
    ).toBe("pending-compute");
    expect(
      resolveAnalysisFreshness({ record, liveStructure: "sig-B", computeStatus: "idle" })
    ).toBe("stale-structure");
    expect(
      resolveAnalysisFreshness({ record, liveStructure: "sig-B", computeStatus: "error" })
    ).toBe("pending-compute");
  });

  it("never pollutes history or the canonical scene document", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    const pastBefore = useHistoryStore.getState().past.length;
    store.armDifferentialAnalysisPick(id);
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    store.setDifferentialAnalysisOverlays(id, { showNormal: false });
    store.clearDifferentialAnalysis(id);
    expect(useHistoryStore.getState().past.length).toBe(pastBefore);

    const scene = useGraphStore.getState().scene;
    const serialized = JSON.parse(serializeScene(scene)) as { objects: unknown[] };
    expect(JSON.stringify(serialized)).not.toContain("differentialAnalysis");
    expect(JSON.stringify(serialized)).not.toContain("showTangent");
  });

  it("excludes analysis from session persistence", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.setDifferentialAnalysisPoint(id, POINT, "dark::struct-1");
    store.armDifferentialAnalysisPick(id);
    const options = useGraphStore.persist.getOptions();
    const partialized = options.partialize?.(useGraphStore.getState()) as {
      ui: { differentialAnalysisBySourceId: unknown; differentialAnalysisPickArmedId: unknown };
    };
    expect(partialized.ui.differentialAnalysisBySourceId).toEqual({});
    expect(partialized.ui.differentialAnalysisPickArmedId).toBeNull();
  });

  it("selecting away disarms the pick; selecting the source keeps it", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    const other = store.addSurfaceObject();
    store.armDifferentialAnalysisPick(id);
    store.selectObject(id);
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBe(id);
    store.selectObject(other);
    expect(useGraphStore.getState().ui.differentialAnalysisPickArmedId).toBeNull();
  });
});

describe("analysisSourceIdentity (S21-R1)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("covers math identity and ignores appearance", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    const read = () =>
      useGraphStore.getState().scene.objects.find((o) => o.id === id)!;
    const base = analysisSourceIdentity(read());
    expect(base).not.toBeNull();

    // Appearance-only changes retain identity.
    store.toggleSurfaceWireframe(id);
    store.updateObjectColor(id, "#f59e0b");
    expect(analysisSourceIdentity(read())).toBe(base);

    // Math changes invalidate.
    store.updateSurfaceEquation(id, "z = x^2 + y^2");
    expect(analysisSourceIdentity(read())).not.toBe(base);
    const afterEquation = analysisSourceIdentity(read());
    store.updateSurfaceDomain(id, { xMax: 6 });
    expect(analysisSourceIdentity(read())).not.toBe(afterEquation);
    store.updateSurfaceResolution(id, 48);
    expect(analysisSourceIdentity(read())).not.toBe(base);
  });

  it("returns null for unsupported kinds", () => {
    const store = useGraphStore.getState();
    const curveId = store.addParametricCurve();
    const curve = useGraphStore.getState().scene.objects.find((o) => o.id === curveId)!;
    expect(analysisSourceIdentity(curve)).toBeNull();
  });
});
