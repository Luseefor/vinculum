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
  syncScalarViz,
  setScalarVizDisplayDomains,
  pumpScalarVizJobs
} from "@/lib/compute/scalarVizSync";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { surfaceDisplayDomain, surfaceDisplayDomain2D } from "@/lib/graph3d/surfaceDisplayDomain";
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

  it("resamples only new Follow View tiles and rejects late results without changing saved bounds", () => {
    const id = addSurface();
    enableField(id);
    const source = liveObject(id);
    const params = getEditorParameterScope();
    const before = serializeScene(useGraphStore.getState().scene);
    const context = createScalarSyncTestContext(response => {
      applyScalarVizResponse(response, useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.scalarVizBySourceId, params, context.displayDomains);
    });
    context.displayDomains = { [id]: { xMin: -16, xMax: 16, yMin: -16, yMax: 16 } };
    syncScalarViz(context, [source], params);
    const entry = useScalarVizResultsStore.getState().entries[`scalar:${id}`];
    expect(entry?.result).toMatchObject({ status: "ok", domain: { uMin: -16, uMax: 16, vMin: -16, vMax: 16 } });
    syncScalarViz(context, [source], params);
    expect(context.requests).toHaveLength(1);
    context.displayDomains[id] = { xMin: 0, xMax: 64, yMin: -32, yMax: 32 };
    const stale: GeometryComputeResponse = { requestId: 1, generation: 1, objectId: `scalar:${id}`,
      kind: "scalarField", structure: entry!.signature, result: { status: "empty" } };
    expect(applyScalarVizResponse(stale, [source], useGraphStore.getState().ui.scalarVizBySourceId,
      params, context.displayDomains)).toBe(false);
    syncScalarViz(context, [source], params);
    expect(context.requests).toHaveLength(2);
    expect(useScalarVizResultsStore.getState().entries[`scalar:${id}`]?.result).toMatchObject({
      status: "ok", domain: { uMin: 0, uMax: 64, vMin: -32, vMax: 32 }
    });
    // Leaving 3D restores the fixed 2D sampling domain, using the same cache.
    context.displayDomains = {};
    syncScalarViz(context, [source], params);
    expect(context.requests).toHaveLength(3);
    expect(useScalarVizResultsStore.getState().entries[`scalar:${id}`]?.result).toMatchObject({
      domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 }
    });
    expect(serializeScene(useGraphStore.getState().scene)).toBe(before);
    context.manager.dispose();
  });

  it("follows 2D pan, zoom, and resize with quantized jobs while preserving fixed bounds", () => {
    const id = addSurface();
    useGraphStore.getState().setSurfaceAutoDomain(id, true);
    enableField(id);
    const source = liveObject(id);
    if (source.kind !== "surface") throw new Error("expected surface");
    const saved = serializeScene(useGraphStore.getState().scene);
    const params = getEditorParameterScope();
    const context = createScalarSyncTestContext(response => {
      applyScalarVizResponse(response, [source], useGraphStore.getState().ui.scalarVizBySourceId, params, context.displayDomains);
    });
    const owner = {};
    const frame = { width: 800, height: 600 };
    const viewport = { centerX: 0, centerY: 0, scale: 50 };
    const request = (view = viewport, size = frame) => {
      const domain = surfaceDisplayDomain2D(source, view, size);
      setScalarVizDisplayDomains(context, owner, { [id]: domain });
      syncScalarViz(context, [source], params);
      return domain;
    };
    const first = request();
    expect(first.xMin).toBeLessThanOrEqual(-8);
    expect(first.xMax).toBeGreaterThanOrEqual(8);
    const firstResult = useScalarVizResultsStore.getState().entries[`scalar:${id}`]!.result;
    expect(firstResult.status).toBe("ok");
    if (firstResult.status === "ok") {
      expect(Math.sqrt(firstResult.levels[0])).toBeLessThan(frame.height / (2 * viewport.scale));
    }
    expect(request({ ...viewport, centerX: 0.01 })).toEqual(first);
    expect(context.requests).toHaveLength(1);
    const moved = request({ ...viewport, centerX: 80, centerY: -40 });
    expect(moved.xMin).toBeLessThanOrEqual(72);
    expect(moved.xMax).toBeGreaterThanOrEqual(88);
    expect(context.requests).toHaveLength(2);
    const zoomed = request({ ...viewport, scale: 5 });
    expect(zoomed.xMin).toBeLessThanOrEqual(-80);
    expect(zoomed.xMax).toBeGreaterThanOrEqual(80);
    expect(context.requests).toHaveLength(3);
    const resized = request(viewport, { width: 2400, height: 1800 });
    expect(resized.xMax - resized.xMin).toBeGreaterThan(first.xMax - first.xMin);
    expect(context.requests).toHaveLength(4);
    const fixed = { ...source, autoDomain: false };
    expect(surfaceDisplayDomain2D(fixed, { ...viewport, centerX: 80 }, frame)).toEqual(source.domain);
    for (const invalid of [0, -1, Infinity, NaN]) {
      expect(surfaceDisplayDomain2D(source, { ...viewport, scale: invalid }, frame)).toEqual(source.domain);
    }
    expect(surfaceDisplayDomain2D(source, viewport, { width: 0, height: 0 })).toEqual(source.domain);
    const close = surfaceDisplayDomain2D(source, { ...viewport, scale: 2000 }, frame);
    expect(close.xMax - close.xMin).toBeLessThan(1);
    expect(serializeScene(useGraphStore.getState().scene)).toBe(saved);
    context.manager.dispose();
  });

  it("combines visible 2D/3D ranges without competing requests and releases hidden panes", () => {
    const id = addSurface();
    useGraphStore.getState().setSurfaceAutoDomain(id, true);
    enableField(id);
    const source = liveObject(id);
    if (source.kind !== "surface") throw new Error("expected surface");
    const params = getEditorParameterScope();
    const context = createScalarSyncTestContext(response => {
      applyScalarVizResponse(response, [source], useGraphStore.getState().ui.scalarVizBySourceId, params, context.displayDomains);
    });
    const owner2d = {}, owner3d = {}, ownerQuad = {};
    const domain2d = surfaceDisplayDomain2D(source, { centerX: 80, centerY: 0, scale: 50 }, { width: 800, height: 600 });
    const domain3d = surfaceDisplayDomain(source, { distance: 16, fov: 45, aspect: 1, target: { x: 0, y: 0, z: 0 } });
    setScalarVizDisplayDomains(context, owner2d, { [id]: domain2d });
    setScalarVizDisplayDomains(context, owner3d, { [id]: domain3d });
    syncScalarViz(context, [source], params);
    expect(context.displayDomains![id]).toMatchObject({ xMin: domain3d.xMin, xMax: domain2d.xMax });
    const sharedEntry = useScalarVizResultsStore.getState().entries[`scalar:${id}`]!;
    for (let frame = 0; frame < 3; frame++) {
      setScalarVizDisplayDomains(context, owner3d, { [id]: domain3d });
      syncScalarViz(context, [source], params);
    }
    expect(context.requests).toHaveLength(1);
    // A second 2D pane can contribute independently, then disappear.
    const quad = { ...domain2d, yMin: -200, yMax: -160 };
    setScalarVizDisplayDomains(context, ownerQuad, { [id]: quad });
    syncScalarViz(context, [source], params);
    expect(context.displayDomains![id].yMin).toBe(-200);
    setScalarVizDisplayDomains(context, ownerQuad, null);
    setScalarVizDisplayDomains(context, owner3d, null);
    syncScalarViz(context, [source], params);
    expect(context.displayDomains![id]).toEqual(domain2d);
    const late: GeometryComputeResponse = { requestId: 1, generation: 1, objectId: `scalar:${id}`,
      kind: "scalarField", structure: sharedEntry.signature, result: sharedEntry.result };
    expect(applyScalarVizResponse(late, [source], useGraphStore.getState().ui.scalarVizBySourceId, params, context.displayDomains)).toBe(false);
    setScalarVizDisplayDomains(context, owner2d, null);
    expect(context.displayDomains).toEqual({});
    expect(context.displayDomainsByViewport!.size).toBe(0);
    context.manager.dispose();
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
