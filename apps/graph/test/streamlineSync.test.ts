import { beforeEach, describe, expect, it } from "vitest";
import type { GraphObject } from "@vinculum/scene/types";
import { computeScenePressureFromObjects } from "@/lib/performance/performanceMetrics";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { serializeScene } from "@/lib/scene/serializeScene";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import {
  applyStreamlineResponse,
  buildStreamlineJob,
  createStreamlineSyncTestContext,
  pumpStreamlineJobs
} from "@/lib/compute/streamlineSync";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GeometryComputeResponse } from "@/lib/compute/geometryComputeProtocol";

function addField2D(): string {
  return useGraphStore.getState().addVectorFieldObject("2d");
}

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function identityOf(id: string): string {
  const identity = vectorCalculusSourceIdentity(
    liveObject(id),
    useEditorStore.getState().parameters.map((p) => p.id)
  );
  if (!identity) {
    throw new Error("expected streamline identity");
  }
  return identity;
}

function enableStreamlines(id: string, patch: Record<string, unknown> = {}) {
  const object = liveObject(id);
  if (object.kind !== "vectorField") {
    throw new Error("expected vector field");
  }
  useGraphStore.getState().setStreamlineConfig(
    id,
    { dimension: object.dimension, enabled: true, ...patch },
    identityOf(id)
  );
  const config = useGraphStore.getState().ui.streamlineVizBySourceId[id];
  if (!config) {
    throw new Error("expected streamline config");
  }
  return config;
}

describe("streamline job builders (S24 PART 10/11)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("builds no job when disabled or unconfigured", () => {
    const id = addField2D();
    const params = getEditorParameterScope();
    expect(buildStreamlineJob(liveObject(id), undefined, params)).toBeNull();
    useGraphStore.getState().setStreamlineConfig(id, { dimension: "2d" }, identityOf(id));
    expect(
      buildStreamlineJob(liveObject(id), useGraphStore.getState().ui.streamlineVizBySourceId[id], params)
    ).toBeNull();
  });

  it("builds math-only jobs with signature-tracked numerics", () => {
    const id = addField2D();
    const config = enableStreamlines(id);
    const job = buildStreamlineJob(liveObject(id), config, getEditorParameterScope());
    expect(job).not.toBeNull();
    expect(job?.jobId).toBe(`streamline:${id}`);
    expect(job?.payload.dimension).toBe("2d");
    expect(job?.payload.pExpr).toBe("x");
    expect(job?.payload.seedDensity).toBe(6);
    expect(job?.payload.length).toBe("medium");
    expect(job?.payload.quality).toBe("medium");
    // Presentation never enters the payload or signature.
    expect(JSON.stringify(job?.payload)).not.toContain("scale");
    expect(job?.signature).not.toContain("#3b82f6");
  });

  it("clamps seed density to the dimension bounds", () => {
    const id = addField2D();
    const config = enableStreamlines(id, { seedDensity: 99 });
    const job = buildStreamlineJob(liveObject(id), config, getEditorParameterScope());
    expect(job?.payload.seedDensity).toBe(12);
  });
});

describe("pumpStreamlineJobs dedupe (S24 PART 11)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("requests once per signature across view/theme churn", () => {
    const id = addField2D();
    const config = enableStreamlines(id);
    const context = createStreamlineSyncTestContext();
    const params = getEditorParameterScope();
    const job = buildStreamlineJob(liveObject(id), config, params);
    pumpStreamlineJobs(context, [job], params, new Set([`streamline:${id}`]));
    expect(context.requests).toHaveLength(1);
    pumpStreamlineJobs(context, [job], params, new Set([`streamline:${id}`]));
    expect(context.requests).toHaveLength(1);
    // Seed-density change: exactly one new request.
    useGraphStore.getState().setStreamlineConfig(id, { seedDensity: 8 }, config.structure);
    const updated = useGraphStore.getState().ui.streamlineVizBySourceId[id];
    pumpStreamlineJobs(
      context,
      [buildStreamlineJob(liveObject(id), updated, params)],
      params,
      new Set([`streamline:${id}`])
    );
    expect(context.requests).toHaveLength(2);
  });
});

describe("applyStreamlineResponse backstop (S24 PART 12)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("stores fresh results and discards stale ones", () => {
    const id = addField2D();
    const config = enableStreamlines(id);
    const params = getEditorParameterScope();
    const applied: boolean[] = [];
    const context = createStreamlineSyncTestContext((response) => {
      applied.push(
        applyStreamlineResponse(
          response,
          useGraphStore.getState().scene.objects,
          useGraphStore.getState().ui.streamlineVizBySourceId,
          params
        )
      );
    });
    const job = buildStreamlineJob(liveObject(id), config, params);
    pumpStreamlineJobs(context, [job], params, new Set([`streamline:${id}`]));
    expect(applied).toEqual([true]);
    expect(useStreamlineResultsStore.getState().entries[`streamline:${id}`]).toBeDefined();

    // Component edit prunes the config; a late duplicate must not resurrect.
    const stale: GeometryComputeResponse = {
      requestId: 1,
      objectId: `streamline:${id}`,
      generation: 1,
      kind: "streamlines",
      structure: job?.signature ?? "",
      result: { status: "empty" }
    };
    useGraphStore.getState().updateVectorFieldExpression(id, "pExpr", "-y");
    expect(
      applyStreamlineResponse(
        stale,
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.streamlineVizBySourceId,
        params
      )
    ).toBe(false);
  });

  it("rejects wrong-kind and missing-source responses", () => {
    const id = addField2D();
    enableStreamlines(id);
    const configs = useGraphStore.getState().ui.streamlineVizBySourceId;
    expect(
      applyStreamlineResponse(
        {
          requestId: 1,
          objectId: `streamline:${id}`,
          generation: 1,
          kind: "vectorField",
          structure: "x",
          result: { status: "empty" }
        },
        useGraphStore.getState().scene.objects,
        configs,
        {}
      )
    ).toBe(false);
    useGraphStore.getState().removeObject(id);
    expect(
      applyStreamlineResponse(
        {
          requestId: 1,
          objectId: `streamline:${id}`,
          generation: 1,
          kind: "streamlines",
          structure: "x",
          result: { status: "empty" }
        },
        useGraphStore.getState().scene.objects,
        useGraphStore.getState().ui.streamlineVizBySourceId,
        {}
      )
    ).toBe(false);
  });
});

describe("streamline lifecycle (S24 PART 16/17)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useStreamlineResultsStore.getState().clearAll();
  });

  it("sets, patches, and clears configs", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.enabled).toBe(true);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.seedDensity).toBe(6);
    store.setStreamlineConfig(id, { seedDensity: 10 }, identityOf(id));
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.seedDensity).toBe(10);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]?.enabled).toBe(true);
    store.clearStreamline(id);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeUndefined();
  });

  it("prunes math edits but retains glyph-only edits", () => {
    const id = addField2D();
    const store = useGraphStore.getState();
    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    store.updateVectorFieldExpression(id, "qExpr", "x");
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeUndefined();

    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    for (const field of ["density", "scale", "normalize"] as const) {
      store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
      store.updateVectorFieldExpression(
        id,
        field,
        field === "normalize" ? true : field === "density" ? 20 : 2
      );
      expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeDefined();
    }
    store.updateObjectColor(id, "#f59e0b");
    store.toggleObjectVisibility(id);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeDefined();
  });

  it("clears on delete, kind switch, dimension switch, and scene replace", () => {
    const store = useGraphStore.getState();
    const id = addField2D();
    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    useStreamlineResultsStore.getState().setResult(`streamline:${id}`, { signature: "s", result: { status: "empty" } });
    store.setObjectKind(id, "surface");
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id]).toBeUndefined();
    expect(useStreamlineResultsStore.getState().entries[`streamline:${id}`]).toBeUndefined();

    const id2 = addField2D();
    store.setStreamlineConfig(id2, { dimension: "2d", enabled: true }, identityOf(id2));
    store.setObjectKind(id2, "vectorField", "3d");
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id2]).toBeUndefined();

    const id3 = addField2D();
    store.setStreamlineConfig(id3, { dimension: "2d", enabled: true }, identityOf(id3));
    store.removeObject(id3);
    expect(useGraphStore.getState().ui.streamlineVizBySourceId[id3]).toBeUndefined();

    const id4 = addField2D();
    store.setStreamlineConfig(id4, { dimension: "2d", enabled: true }, identityOf(id4));
    store.resetScene();
    expect(useGraphStore.getState().ui.streamlineVizBySourceId).toEqual({});
    expect(useStreamlineResultsStore.getState().entries).toEqual({});
  });

  it("estimates streamline pressure conservatively (S24 PART 34)", () => {
    const store = useGraphStore.getState();
    const id = addField2D();
    const base = computeScenePressureFromObjects(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    expect(base.streamlineSegmentsMax).toBe(0);
    expect(base.streamlineSegmentsPressure).toBe(0);
    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    const loaded = computeScenePressureFromObjects(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    // 6x6 seeds x 512 segments worst-case estimate at defaults.
    expect(loaded.streamlineSegmentsMax).toBe(36 * 512);
    expect(loaded.streamlineSegmentsPressure).toBeGreaterThan(0);
    expect(loaded.streamlineSegmentsPressure).toBeLessThan(0.5);
    // Maxed-out 2D configs honestly trip the warning band.
    store.setStreamlineConfig(id, { seedDensity: 12 }, identityOf(id));
    const maxed = computeScenePressureFromObjects(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    expect(maxed.streamlineSegmentsMax).toBe(144 * 512);
    expect(maxed.streamlineSegmentsPressure).toBeGreaterThanOrEqual(0.98);
    // Hidden sources contribute nothing.
    store.toggleObjectVisibility(id);
    const hidden = computeScenePressureFromObjects(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.streamlineVizBySourceId
    );
    expect(hidden.streamlineSegmentsMax).toBe(0);
  });

  it("never pollutes history, persistence, or the canonical document", () => {
    const store = useGraphStore.getState();
    const id = addField2D();
    store.setStreamlineConfig(id, { dimension: "2d", enabled: true }, identityOf(id));
    store.clearStreamline(id);
    const serialized = JSON.stringify(JSON.parse(serializeScene(useGraphStore.getState().scene)));
    expect(serialized).not.toContain("streamline");
    const options = useGraphStore.persist.getOptions();
    const partialized = options.partialize?.(useGraphStore.getState()) as {
      ui: { streamlineVizBySourceId: unknown };
    };
    expect(partialized.ui.streamlineVizBySourceId).toEqual({});
  });
});
