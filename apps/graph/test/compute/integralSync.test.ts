import { beforeEach, describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { serializeScene } from "@/lib/scene/serializeScene";
import {
  applyIntegralResponse,
  buildIntegralJob,
  createIntegralSyncTestContext,
  pumpIntegralJobs
} from "@/lib/compute/integralSync";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import type { GeometryComputeResponse } from "@/lib/compute/geometryComputeProtocol";
import type { IntegralAnalysisConfig } from "@/types/graphUi";

function addCircle(): string {
  const store = useGraphStore.getState();
  const id = store.addParametricCurve();
  store.updateParametricExpression(id, "xExpr", "cos(t)");
  store.updateParametricExpression(id, "yExpr", "sin(t)");
  store.updateParametricExpression(id, "zExpr", "0");
  store.updateParametricExpression(id, "tMin", 0);
  store.updateParametricExpression(id, "tMax", 2 * Math.PI);
  return id;
}

function addRotationField(): string {
  const store = useGraphStore.getState();
  const id = store.addVectorFieldObject("3d");
  store.updateVectorFieldExpression(id, "pExpr", "-y");
  store.updateVectorFieldExpression(id, "qExpr", "x");
  store.updateVectorFieldExpression(id, "rExpr", "0");
  return id;
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function setMode(id: string, patch: Partial<IntegralAnalysisConfig>): IntegralAnalysisConfig {
  useGraphStore.getState().setIntegralConfig(id, patch);
  const config = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
  if (!config) {
    throw new Error("expected integral config");
  }
  return config;
}

describe("integral job builders (S25 PART 18/40)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("builds no job without a config or for incompatible modes", () => {
    const id = addCircle();
    const params = getEditorParameterScope();
    expect(buildIntegralJob(useGraphStore.getState().scene.objects, undefined, params)).toBeNull();
    const config = setMode(id, { mode: "surfaceArea" });
    expect(buildIntegralJob(useGraphStore.getState().scene.objects, config, params)).toBeNull();
  });

  it("builds arc-length jobs with canonical snapshots", () => {
    const id = addCircle();
    const config = setMode(id, { mode: "arcLength", quality: "medium" });
    const job = buildIntegralJob(useGraphStore.getState().scene.objects, config, getEditorParameterScope());
    expect(job).not.toBeNull();
    expect(job?.jobId).toBe(`integral:${id}`);
    expect(job?.payload.mode).toBe("arcLength");
    expect(job?.payload.target).toMatchObject({ kind: "parametricCurve", tMin: 0 });
    expect((job?.payload.target as { tMax: number }).tMax).toBeCloseTo(2 * Math.PI, 12);
    expect(job?.payload.quality).toBe("medium");
    // Presentation never enters the payload or signature.
    expect(JSON.stringify(job?.payload)).not.toContain("#");
  });

  it("requires committed integrand and resolved field for dependent modes", () => {
    const id = addCircle();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    expect(
      buildIntegralJob(objects(), setMode(id, { mode: "scalarLine", scalarIntegrand: "" }), params)
    ).toBeNull();
    expect(
      buildIntegralJob(objects(), setMode(id, { mode: "scalarLine", scalarIntegrand: "x" }), params)
    ).not.toBeNull();
    expect(
      buildIntegralJob(objects(), setMode(id, { mode: "work", vectorFieldId: null }), params)
    ).toBeNull();
    const fieldId = addRotationField();
    const work = setMode(id, { mode: "work", vectorFieldId: fieldId });
    const job = buildIntegralJob(objects(), work, params);
    expect(job?.payload.field).toMatchObject({ dimension: "3d", pExpr: "-y" });
    // Deleted field: no job (UI shows select-a-field).
    useGraphStore.getState().removeObject(fieldId);
    expect(
      buildIntegralJob(
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.integralAnalysisBySourceId[id],
        params
      )
    ).toBeNull();
  });

  it("embeds field domain and orientation signs in the signature", () => {
    const id = addCircle();
    const fieldId = addRotationField();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    const forward = setMode(id, { mode: "work", vectorFieldId: fieldId, direction: 1 });
    const reverse = { ...forward, direction: -1 as const };
    const forwardJob = buildIntegralJob(objects(), forward, params);
    const reverseJob = buildIntegralJob(objects(), reverse, params);
    expect(forwardJob?.signature).not.toBe(reverseJob?.signature);
    // Field domain edit changes the composite signature.
    const before = forwardJob?.signature;
    useGraphStore.getState().updateVectorFieldExpression(fieldId, "xMax", 6);
    const after = buildIntegralJob(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.integralAnalysisBySourceId[id],
      params
    );
    // Field math edit prunes referencing results; signature covers domain.
    expect(after?.signature).not.toBe(before);
  });
});

describe("mode-segmented signatures (S25-R1 BLOCKER)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("separates arcLength from scalarLine with identical integrand text", () => {
    const id = addCircle();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    setMode(id, { mode: "arcLength", scalarIntegrand: "x" });
    const arc = buildIntegralJob(objects(), useGraphStore.getState().ui.integralAnalysisBySourceId[id], params);
    setMode(id, { mode: "scalarLine", scalarIntegrand: "x" });
    const scalar = buildIntegralJob(objects(), useGraphStore.getState().ui.integralAnalysisBySourceId[id], params);
    expect(arc?.signature).not.toBe(scalar?.signature);
    // Mode switch enqueues a fresh job (no dedupe collision, no stale display).
    const context = createIntegralSyncTestContext();
    pumpIntegralJobs(context, [arc], params, new Set([`integral:${id}`]));
    pumpIntegralJobs(context, [scalar], params, new Set([`integral:${id}`]));
    expect(context.requests).toHaveLength(2);
  });

  it("ignores direction for arc length and orientation for area", () => {
    const id = addCircle();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    const forward = setMode(id, { mode: "arcLength", direction: 1 });
    const reverse = { ...forward, direction: -1 as const };
    expect(buildIntegralJob(objects(), forward, params)?.signature).toBe(
      buildIntegralJob(objects(), reverse, params)?.signature
    );
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "z = 0");
    const native = setMode(surfaceId, { mode: "surfaceArea", orientationSign: 1 });
    const flipped = { ...native, orientationSign: -1 as const };
    expect(buildIntegralJob(objects(), native, params)?.signature).toBe(
      buildIntegralJob(objects(), flipped, params)?.signature
    );
  });

  it("builds no work/flux job for a referenced 2D field (S25-R3)", () => {
    const id = addCircle();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    const store = useGraphStore.getState();
    const fieldId = store.addVectorFieldObject("2d");
    store.updateVectorFieldExpression(fieldId, "pExpr", "-y");
    store.updateVectorFieldExpression(fieldId, "qExpr", "x");
    const work = setMode(id, { mode: "work", vectorFieldId: fieldId });
    expect(buildIntegralJob(objects(), work, params)).toBeNull();
  });
});

describe("render-only exclusion matrix (S25 PART 39/40)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("keeps the composite signature across color, visibility, and tessellation edits", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "z = 0");
    const config = setMode(surfaceId, { mode: "surfaceArea", quality: "medium" });
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    const before = buildIntegralJob(objects(), config, params)?.signature;
    expect(before).toBeTruthy();
    const context = createIntegralSyncTestContext();
    const live = new Set([`integral:${surfaceId}`]);
    const job = buildIntegralJob(objects(), config, params);
    pumpIntegralJobs(context, [job], params, live);
    expect(context.requests).toHaveLength(1);
    // Render-only edits: color, visibility, tessellation. None may change
    // the signature or enqueue a follow-up integral job.
    useGraphStore.getState().updateObjectColor(surfaceId, "#ff0000");
    useGraphStore.getState().setObjectVisibility(surfaceId, false);
    useGraphStore.getState().setObjectVisibility(surfaceId, true);
    useGraphStore.getState().updateSurfaceResolution(surfaceId, 64);
    const liveConfig = useGraphStore.getState().ui.integralAnalysisBySourceId[surfaceId];
    expect(buildIntegralJob(objects(), liveConfig, params)?.signature).toBe(before);
    pumpIntegralJobs(
      context,
      [buildIntegralJob(objects(), liveConfig, params)],
      params,
      live
    );
    expect(context.requests).toHaveLength(1);
  });

  it("keeps analysis config edits out of undo history and persistence", () => {
    const id = addCircle();
    const depth = useHistoryStore.getState().past.length;
    useGraphStore.getState().setIntegralConfig(id, { mode: "scalarLine", scalarIntegrand: "x", quality: "high" });
    useGraphStore.getState().setIntegralConfig(id, { direction: -1 });
    useGraphStore.getState().clearIntegralAnalysis(id);
    expect(useHistoryStore.getState().past.length).toBe(depth);
    expect(serializeScene(useGraphStore.getState().scene)).not.toContain("integral");
  });
});

describe("pumpIntegralJobs dedupe (S25 PART 40)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("requests once per composite signature", () => {
    const id = addCircle();
    const config = setMode(id, { mode: "arcLength" });
    const context = createIntegralSyncTestContext();
    const params = getEditorParameterScope();
    const objects = () => useGraphStore.getState().scene.objects;
    const job = buildIntegralJob(objects(), config, params);
    pumpIntegralJobs(context, [job], params, new Set([`integral:${id}`]));
    expect(context.requests).toHaveLength(1);
    pumpIntegralJobs(context, [job], params, new Set([`integral:${id}`]));
    expect(context.requests).toHaveLength(1);
    // Quality change: exactly one new request.
    setMode(id, { quality: "high" });
    const updated = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
    pumpIntegralJobs(
      context,
      [buildIntegralJob(objects(), updated, params)],
      params,
      new Set([`integral:${id}`])
    );
    expect(context.requests).toHaveLength(2);
  });
});

describe("applyIntegralResponse multi-source backstop (S25 PART 18/20)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("stores fresh results and discards stale ones", () => {
    const id = addCircle();
    const config = setMode(id, { mode: "arcLength" });
    const params = getEditorParameterScope();
    const applied: boolean[] = [];
    const context = createIntegralSyncTestContext((response) => {
      applied.push(
        applyIntegralResponse(
          response,
          useGraphStore.getState().scene.objects,
          useGraphStore.getState().ui.integralAnalysisBySourceId,
          params
        )
      );
    });
    const job = buildIntegralJob(useGraphStore.getState().scene.objects, config, params);
    pumpIntegralJobs(context, [job], params, new Set([`integral:${id}`]));
    expect(applied).toEqual([true]);
    const entry = useIntegralResultsStore.getState().entries[`integral:${id}`];
    expect(entry?.result.status).toBe("ok");
    if (entry?.result.status === "ok") {
      expect(entry.result.value).toBeCloseTo(2 * Math.PI, 4);
    }

    // Target edit prunes the config; a late duplicate must not resurrect.
    const stale: GeometryComputeResponse = {
      requestId: 1,
      objectId: `integral:${id}`,
      generation: 1,
      kind: "integralAnalysis",
      structure: job?.signature ?? "",
      result: { status: "ok", value: 0, coarseValue: 0, estimatedError: 0, convergenceWarning: false, evaluationCount: 1 }
    };
    useGraphStore.getState().updateParametricExpression(id, "xExpr", "2*cos(t)");
    expect(
      applyIntegralResponse(
        stale,
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.integralAnalysisBySourceId,
        params
      )
    ).toBe(false);
  });

  it("discards late results after field edits (multi-source race)", () => {
    const id = addCircle();
    const fieldId = addRotationField();
    setMode(id, { mode: "work", vectorFieldId: fieldId });
    const params = getEditorParameterScope();
    const applied: boolean[] = [];
    const context = createIntegralSyncTestContext((response) => {
      applied.push(
        applyIntegralResponse(
          response,
          useGraphStore.getState().scene.objects,
          useGraphStore.getState().ui.integralAnalysisBySourceId,
          params
        )
      );
    });
    const objects = () => useGraphStore.getState().scene.objects;
    const config = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
    pumpIntegralJobs(context, [buildIntegralJob(objects(), config, params)], params, new Set([`integral:${id}`]));
    expect(applied).toEqual([true]);
    const signature = useIntegralResultsStore.getState().entries[`integral:${id}`]?.signature;
    // Field edit changes the composite signature: replay the old response.
    useGraphStore.getState().updateVectorFieldExpression(fieldId, "pExpr", "-2*y");
    const replay: GeometryComputeResponse = {
      requestId: 1,
      objectId: `integral:${id}`,
      generation: 1,
      kind: "integralAnalysis",
      structure: signature ?? "",
      result: { status: "ok", value: 0, coarseValue: 0, estimatedError: 0, convergenceWarning: false, evaluationCount: 1 }
    };
    expect(applyIntegralResponse(replay, objects(), useGraphStore.getState().ui.integralAnalysisBySourceId, params)).toBe(
      false
    );
  });

  it("rejects wrong-kind and missing-target responses", () => {
    const id = addCircle();
    setMode(id, { mode: "arcLength" });
    const configs = useGraphStore.getState().ui.integralAnalysisBySourceId;
    expect(
      applyIntegralResponse(
        { requestId: 1, objectId: `integral:${id}`, generation: 1, kind: "vectorField", structure: "x", result: { status: "empty" } },
        useGraphStore.getState().scene.objects,
        configs,
        {}
      )
    ).toBe(false);
    useGraphStore.getState().removeObject(id);
    expect(
      applyIntegralResponse(
        { requestId: 1, objectId: `integral:${id}`, generation: 1, kind: "integralAnalysis", structure: "x", result: { status: "empty" } },
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.integralAnalysisBySourceId,
        {}
      )
    ).toBe(false);
  });
});

describe("integral lifecycle (S25 PART 26/41/42)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useIntegralResultsStore.getState().clearAll();
  });

  it("sets, patches, and clears configs with same-value no-ops", () => {
    const id = addCircle();
    const store = useGraphStore.getState();
    store.setIntegralConfig(id, { mode: "arcLength" });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]?.mode).toBe("arcLength");
    const before = useGraphStore.getState().ui.integralAnalysisBySourceId;
    store.setIntegralConfig(id, { mode: "arcLength" });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId).toBe(before);
    store.setIntegralConfig(id, { quality: "high" });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]?.quality).toBe("high");
    store.clearIntegralAnalysis(id);
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeUndefined();
  });

  it("drops results but keeps configs on curve math edits; sampling touches nothing", () => {
    // S25 keep-and-recompute: math edits change the composite signature
    // (old numbers hidden, fresh job refires), but the user never
    // reconfigures — unlike pick-anchored S21/S22 analysis, integrals have
    // no anchor an edit can invalidate.
    const id = addCircle();
    const store = useGraphStore.getState();
    store.setIntegralConfig(id, { mode: "arcLength" });
    useIntegralResultsStore.getState().setResult(`integral:${id}`, {
      signature: "s",
      result: { status: "ok", value: 1, coarseValue: 1, estimatedError: 0, convergenceWarning: false, evaluationCount: 8 }
    });
    store.updateParametricExpression(id, "tMax", 3);
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeDefined();
    expect(useIntegralResultsStore.getState().entries[`integral:${id}`]).toBeUndefined();
    store.setIntegralConfig(id, { mode: "arcLength" });
    useIntegralResultsStore.getState().setResult(`integral:${id}`, {
      signature: "s",
      result: { status: "ok", value: 1, coarseValue: 1, estimatedError: 0, convergenceWarning: false, evaluationCount: 8 }
    });
    store.updateParametricExpression(id, "samples", 400);
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeDefined();
    expect(useIntegralResultsStore.getState().entries[`integral:${id}`]).toBeDefined();
  });

  it("drops results but keeps configs on surface math; tessellation touches nothing", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.updateSurfaceEquation(id, "z = 0");
    store.setIntegralConfig(id, { mode: "surfaceArea" });
    useIntegralResultsStore.getState().setResult(`integral:${id}`, {
      signature: "s",
      result: { status: "ok", value: 4, coarseValue: 4, estimatedError: 0, convergenceWarning: false, evaluationCount: 8 }
    });
    store.updateSurfaceResolution(id, 32);
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeDefined();
    expect(useIntegralResultsStore.getState().entries[`integral:${id}`]).toBeDefined();
    store.updateSurfaceDomain(id, { xMax: 2 });
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeDefined();
    expect(useIntegralResultsStore.getState().entries[`integral:${id}`]).toBeUndefined();
  });

  it("clears field selections on field delete without touching target configs", () => {
    const store = useGraphStore.getState();
    const id = addCircle();
    const fieldId = addRotationField();
    store.setIntegralConfig(id, { mode: "work", vectorFieldId: fieldId });
    useIntegralResultsStore.getState().setResult(`integral:${id}`, {
      signature: "s",
      result: { status: "ok", value: 1, coarseValue: 1, estimatedError: 0, convergenceWarning: false, evaluationCount: 8 }
    });
    store.removeObject(fieldId);
    const config = useGraphStore.getState().ui.integralAnalysisBySourceId[id];
    expect(config).toBeDefined();
    expect(config?.vectorFieldId).toBeNull();
    expect(useIntegralResultsStore.getState().entries[`integral:${id}`]).toBeUndefined();
  });

  it("clears on target delete, kind switch, and scene replace", () => {
    const store = useGraphStore.getState();
    const id = addCircle();
    store.setIntegralConfig(id, { mode: "arcLength" });
    store.setObjectKind(id, "surface");
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id]).toBeUndefined();

    const id2 = addCircle();
    store.setIntegralConfig(id2, { mode: "arcLength" });
    store.removeObject(id2);
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId[id2]).toBeUndefined();

    const id3 = addCircle();
    store.setIntegralConfig(id3, { mode: "arcLength" });
    store.resetScene();
    expect(useGraphStore.getState().ui.integralAnalysisBySourceId).toEqual({});
    expect(useIntegralResultsStore.getState().entries).toEqual({});
  });

  it("never pollutes serialization, persistence, or history", () => {
    const store = useGraphStore.getState();
    const id = addCircle();
    store.setIntegralConfig(id, { mode: "arcLength", scalarIntegrand: "x" });
    store.clearIntegralAnalysis(id);
    const serialized = JSON.stringify(JSON.parse(serializeScene(useGraphStore.getState().scene)));
    expect(serialized).not.toContain("integralAnalysis");
    expect(serialized).not.toContain("scalarIntegrand");
    const options = useGraphStore.persist.getOptions();
    const partialized = options.partialize?.(useGraphStore.getState()) as {
      ui: { integralAnalysisBySourceId: unknown };
    };
    expect(partialized.ui.integralAnalysisBySourceId).toEqual({});
  });
});
