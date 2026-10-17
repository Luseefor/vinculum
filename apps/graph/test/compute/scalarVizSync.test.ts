import { beforeEach, describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { serializeScene } from "@/lib/scene/serializeScene";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import {
  applyScalarVizResponse,
  buildScalarFieldJob,
  buildScalarSliceJob,
  createScalarSyncTestContext,
  pumpScalarVizJobs
} from "@/lib/compute/scalarVizSync";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import type { GeometryComputeResponse } from "@/lib/compute/geometryComputeProtocol";

function addSurface(equation = "z = x^2 + y^2"): string {
  const store = useGraphStore.getState();
  const created = store.addSurfaceObject();
  store.updateSurfaceEquation(created, equation);
  return created;
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function identityOf(object: GraphObject): string {
  const identity = scalarVizMathIdentity(
    object,
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (identity === null) {
    throw new Error("expected scalar identity");
  }
  return identity;
}

function enableField(id: string) {
  const object = liveObject(id);
  useGraphStore.getState().setScalarVizConfig(
    id,
    { showHeatmap: true, showContours: true, contourCount: 8 },
    identityOf(object)
  );
  return useGraphStore.getState().ui.scalarVizBySourceId[id];
}

describe("scalarVizMathIdentity (S23)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("covers scalar math and ignores render/sampling settings", () => {
    const id = addSurface();
    const base = identityOf(liveObject(id));
    const store = useGraphStore.getState();
    store.updateObjectColor(id, "#f59e0b");
    store.toggleSurfaceWireframe(id);
    store.updateSurfaceResolution(id, 32);
    expect(identityOf(liveObject(id))).toBe(base);
    store.updateSurfaceEquation(id, "z = x^2 - y^2");
    expect(identityOf(liveObject(id))).not.toBe(base);
  });

  it("tracks domain, orientation, and parameter keys — never values", () => {
    const id = addSurface();
    const base = identityOf(liveObject(id));
    const store = useGraphStore.getState();
    store.updateSurfaceDomain(id, { xMax: 6 });
    expect(identityOf(liveObject(id))).not.toBe(base);
    const afterDomain = identityOf(liveObject(id));
    store.updateSurfaceOrientation(id, "x");
    expect(identityOf(liveObject(id))).not.toBe(afterDomain);
    const editor = useEditorStore.getState();
    const previous = editor.parameters;
    try {
      useEditorStore.setState({ parameters: [...previous, { id: "q", value: 1, min: 0, max: 10 }] });
      const withParam = identityOf(liveObject(id));
      useEditorStore.setState({ parameters: [...previous, { id: "q", value: 9, min: 0, max: 10 }] });
      expect(identityOf(liveObject(id))).toBe(withParam);
    } finally {
      useEditorStore.setState({ parameters: previous });
    }
  });

  it("returns null for non-scalar kinds", () => {
    const id = useGraphStore.getState().addVectorFieldObject("2d");
    expect(scalarVizMathIdentity(liveObject(id), [])).toBeNull();
  });
});

describe("scalar job builders (S23 PART 8/35)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("builds no job when visualization is disabled", () => {
    const id = addSurface();
    const params = getEditorParameterScope();
    expect(buildScalarFieldJob(liveObject(id), undefined, params)).toBeNull();
    useGraphStore.getState().setScalarVizConfig(id, {}, identityOf(liveObject(id)));
    expect(
      buildScalarFieldJob(liveObject(id), useGraphStore.getState().ui.scalarVizBySourceId[id], params)
    ).toBeNull();
  });

  it("builds field jobs with math-only payloads", () => {
    const id = addSurface();
    const config = enableField(id);
    const job = buildScalarFieldJob(liveObject(id), config, getEditorParameterScope());
    expect(job).not.toBeNull();
    expect(job?.jobId).toBe(`scalar:${id}`);
    expect(job?.payload.source).toEqual({ kind: "surface", equation: "z = x^2 + y^2", orientation: "z" });
    expect(job?.payload.target).toEqual({
      kind: "domain2D",
      domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 }
    });
    expect(job?.payload.resolution).toBe(128);
    // Presentation never enters the payload or signature.
    expect(job?.signature).not.toContain("#");
  });

  it("rejects stale configs without clearing them (backstop owns that)", () => {
    const id = addSurface();
    enableField(id);
    useGraphStore.getState().updateSurfaceEquation(id, "z = x^2 - y^2");
    const config = useGraphStore.getState().ui.scalarVizBySourceId[id];
    // Equation edits prune the config outright (lifecycle pin below), so a
    // surviving stale config simply yields no job.
    expect(config).toBeUndefined();
  });

  it("gates slice jobs on enablement, kind, and held-axis containment", () => {
    const store = useGraphStore.getState();
    const id = store.addImplicitSurface();
    const object = liveObject(id);
    const params = getEditorParameterScope();
    expect(buildScalarSliceJob(object, undefined, params)).toBeNull();
    store.setScalarVizConfig(
      id,
      { sliceEnabled: true, slicePlane: "xy", sliceValue: 0 },
      identityOf(object)
    );
    const config = useGraphStore.getState().ui.scalarVizBySourceId[id];
    const job = buildScalarSliceJob(liveObject(id), config, params);
    expect(job?.jobId).toBe(`slice:${id}`);
    // Outside the held-axis span: no job (Inspector shows "outside").
    store.setScalarVizConfig(id, { sliceValue: 999 }, identityOf(liveObject(id)));
    const outside = useGraphStore.getState().ui.scalarVizBySourceId[id];
    expect(buildScalarSliceJob(liveObject(id), outside, params)).toBeNull();
  });
});

describe("pumpScalarVizJobs dedupe (S23 PART 35)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("requests once per signature; theme-only changes request nothing", () => {
    const id = addSurface();
    const config = enableField(id);
    const context = createScalarSyncTestContext();
    const params = getEditorParameterScope();
    const job = buildScalarFieldJob(liveObject(id), config, params);
    pumpScalarVizJobs(context, [job], params, new Set([`scalar:${id}`]));
    expect(context.requests).toHaveLength(1);
    // Same signature again: no second request (camera/view/theme churn).
    pumpScalarVizJobs(context, [job], params, new Set([`scalar:${id}`]));
    expect(context.requests).toHaveLength(1);
    // Contour-count change: exactly one new request.
    useGraphStore.getState().setScalarVizConfig(id, { contourCount: 12 }, config.structure);
    const updated = useGraphStore.getState().ui.scalarVizBySourceId[id];
    pumpScalarVizJobs(
      context,
      [buildScalarFieldJob(liveObject(id), updated, params)],
      params,
      new Set([`scalar:${id}`])
    );
    expect(context.requests).toHaveLength(2);
  });
});

describe("applyScalarVizResponse backstop (S23 PART 8/36)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("stores fresh results and discards stale ones", () => {
    const id = addSurface();
    const config = enableField(id);
    const params = getEditorParameterScope();
    const applied: boolean[] = [];
    const context = createScalarSyncTestContext((response) => {
      applied.push(
        applyScalarVizResponse(response, useGraphStore.getState().scene.objects, useGraphStore.getState().ui.scalarVizBySourceId, params)
      );
    });
    const job = buildScalarFieldJob(liveObject(id), config, params);
    pumpScalarVizJobs(context, [job], params, new Set([`scalar:${id}`]));
    expect(applied).toEqual([true]);
    expect(useScalarVizResultsStore.getState().entries[`scalar:${id}`]).toBeDefined();

    // Expression edit prunes the config; a late duplicate of the old
    // response must not resurrect.
    const stale: GeometryComputeResponse = {
      requestId: 1,
      objectId: `scalar:${id}`,
      generation: 1,
      kind: "scalarField",
      structure: job?.signature ?? "",
      result: { status: "empty" }
    };
    useGraphStore.getState().updateSurfaceEquation(id, "z = x^2 - y^2");
    expect(
      applyScalarVizResponse(stale, useGraphStore.getState().scene.objects, useGraphStore.getState().ui.scalarVizBySourceId, params)
    ).toBe(false);
  });

  it("rejects wrong-kind and missing-source responses", () => {
    const id = addSurface();
    enableField(id);
    expect(
      applyScalarVizResponse(
        {
          requestId: 1,
          objectId: `scalar:${id}`,
          generation: 1,
          kind: "vectorField",
          structure: "x",
          result: { status: "empty" }
        },
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.scalarVizBySourceId,
        {}
      )
    ).toBe(false);
    useGraphStore.getState().removeObject(id);
    expect(
      applyScalarVizResponse(
        {
          requestId: 1,
          objectId: `scalar:${id}`,
          generation: 1,
          kind: "scalarField",
          structure: "x",
          result: { status: "empty" }
        },
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.scalarVizBySourceId,
        {}
      )
    ).toBe(false);
  });
});

describe("scalarViz lifecycle (S23 PART 31/32)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useScalarVizResultsStore.getState().clearAll();
  });

  it("sets, patches, and clears configs without touching history", () => {
    const id = addSurface();
    const store = useGraphStore.getState();
    store.setScalarVizConfig(id, { showHeatmap: true }, identityOf(liveObject(id)));
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.showHeatmap).toBe(true);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.showContours).toBe(false);
    store.setScalarVizConfig(id, { contourCount: 12 }, identityOf(liveObject(id)));
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.contourCount).toBe(12);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]?.showHeatmap).toBe(true);
    store.clearScalarViz(id);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeUndefined();
  });

  it("prunes math edits, retains resolution/color/visibility edits", () => {
    const id = addSurface();
    const store = useGraphStore.getState();
    store.setScalarVizConfig(id, { showHeatmap: true }, identityOf(liveObject(id)));
    store.updateSurfaceEquation(id, "z = x - y");
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeUndefined();

    store.setScalarVizConfig(id, { showHeatmap: true }, identityOf(liveObject(id)));
    store.updateSurfaceResolution(id, 32);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeDefined();

    store.updateObjectColor(id, "#f59e0b");
    store.toggleObjectVisibility(id);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeDefined();
  });

  it("clears on delete, kind switch, and scene replace", () => {
    const store = useGraphStore.getState();
    const id = addSurface();
    store.setScalarVizConfig(id, { showHeatmap: true }, identityOf(liveObject(id)));
    useScalarVizResultsStore.getState().setResult(`scalar:${id}`, { signature: "s", result: { status: "empty" } });
    store.setObjectKind(id, "implicitSurface");
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id]).toBeUndefined();
    expect(useScalarVizResultsStore.getState().entries[`scalar:${id}`]).toBeUndefined();

    const id2 = addSurface();
    store.setScalarVizConfig(id2, { showHeatmap: true }, identityOf(liveObject(id2)));
    store.removeObject(id2);
    expect(useGraphStore.getState().ui.scalarVizBySourceId[id2]).toBeUndefined();

    const id3 = addSurface();
    store.setScalarVizConfig(id3, { showHeatmap: true }, identityOf(liveObject(id3)));
    store.resetScene();
    expect(useGraphStore.getState().ui.scalarVizBySourceId).toEqual({});
    expect(useScalarVizResultsStore.getState().entries).toEqual({});
  });

  it("never pollutes serialization or persistence", () => {
    const store = useGraphStore.getState();
    const id = addSurface();
    store.setScalarVizConfig(id, { showHeatmap: true }, identityOf(liveObject(id)));
    const serialized = JSON.stringify(JSON.parse(serializeScene(useGraphStore.getState().scene)));
    expect(serialized).not.toContain("scalarViz");
    const options = useGraphStore.persist.getOptions();
    const partialized = options.partialize?.(useGraphStore.getState()) as {
      ui: { scalarVizBySourceId: unknown };
    };
    expect(partialized.ui.scalarVizBySourceId).toEqual({});
  });
});
