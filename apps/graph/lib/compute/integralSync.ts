import type { GraphObject } from "@vinculum/scene/types";
import { getParamScopeSignature } from "@/lib/math/paramScope";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { useGraphStore } from "@/store/graphStore";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import {
  integralCurveMathIdentity,
  integralParametricSurfaceMathIdentity
} from "@/store/graphStoreSliceIntegral";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import type { IntegralAnalysisConfig, IntegralAnalysisMode } from "@/types/graphUi";
import {
  createGeometryComputeManager,
  type GeometryComputeManager,
  type GeometryWorkerTransport
} from "./geometryComputeManager";
import type {
  GeometryComputeResponse,
  IntegralAnalysisNonOkResult,
  IntegralAnalysisOkResult,
  IntegralAnalysisPayload,
  IntegralTargetPayload
} from "./geometryComputeProtocol";
import { integralResultKey, useIntegralResultsStore } from "./integralResults";

// S25 integral request/applier layer over the shared S19 manager +
// protocol (S23/S24 sync pattern). One module-level manager (same worker
// file, extended kinds — NOT a separate integral worker or manager
// implementation). Results are Inspector-only numerics, so the ONLY pump
// site is the Integral Analysis section effect — no tick, no canvas, no
// Three involvement. Per-target generations plus the composite-signature
// backstop give integral jobs the exact S19 race model, generalized to
// multi-source dependencies (PART 18/20).
//
// Composite signature segments (PART 18): target math structure +
// field math structure + integrand text + quality + direction +
// orientation + parameter VALUES. A late result applies only if every
// dependency still matches. The `integral:<targetId>` namespace keeps
// generations/queues/statuses collision-free (PART 19: one active mode
// per target).

export interface IntegralJob {
  jobId: string;
  payload: IntegralAnalysisPayload;
  signature: string;
}

const CURVE_MODES: IntegralAnalysisMode[] = ["arcLength", "scalarLine", "work"];
const SURFACE_MODES: IntegralAnalysisMode[] = ["surfaceArea", "scalarSurface", "flux"];

// Desired integral job for a target+config, or null when no computation
// is possible yet (disabled paths, missing integrand/field, incompatible
// mode/kind, stale identity). Pure: safe to call on every render; the
// caller requests only on signature change, so tab switches and theme
// changes enqueue 0 jobs.
export function buildIntegralJob(
  objects: readonly GraphObject[],
  config: IntegralAnalysisConfig | undefined,
  params: Record<string, number>
): IntegralJob | null {
  if (!config) {
    return null;
  }
  const target = objects.find((object) => object.id === config.sourceId);
  if (!target) {
    return null;
  }
  const paramKeys = Object.keys(params);
  let targetPayload: IntegralTargetPayload;
  let targetStructure: string | null;
  if (target.kind === "parametricCurve") {
    if (!CURVE_MODES.includes(config.mode)) {
      return null;
    }
    targetPayload = {
      kind: "parametricCurve",
      xExpr: target.xExpr,
      yExpr: target.yExpr,
      zExpr: target.zExpr,
      tMin: target.tMin,
      tMax: target.tMax
    };
    targetStructure = integralCurveMathIdentity(target, paramKeys);
  } else if (target.kind === "surface") {
    if (!SURFACE_MODES.includes(config.mode)) {
      return null;
    }
    targetPayload = {
      kind: "surface",
      equation: target.equation,
      orientation: target.orientation ?? "z",
      domain: { ...target.domain }
    };
    targetStructure = scalarVizMathIdentity(target, paramKeys);
  } else if (target.kind === "parametricSurface") {
    if (!SURFACE_MODES.includes(config.mode)) {
      return null;
    }
    targetPayload = {
      kind: "parametricSurface",
      xExpr: target.xExpr,
      yExpr: target.yExpr,
      zExpr: target.zExpr,
      domain: { ...target.domain }
    };
    targetStructure = integralParametricSurfaceMathIdentity(target, paramKeys);
  } else {
    return null;
  }
  if (targetStructure === null) {
    return null;
  }

  const needsIntegrand = config.mode === "scalarLine" || config.mode === "scalarSurface";
  if (needsIntegrand && config.scalarIntegrand.trim() === "") {
    return null;
  }
  const needsField = config.mode === "work" || config.mode === "flux";
  let fieldPayload: IntegralAnalysisPayload["field"] = null;
  let fieldStructure = "nofield";
  if (needsField) {
    if (!config.vectorFieldId) {
      return null;
    }
    const field = objects.find((object) => object.id === config.vectorFieldId);
    if (!field || field.kind !== "vectorField") {
      return null;
    }
    // S25-R3: work/flux are 3D-only (PART 8/13 fail-closed). A referenced
    // 2D field builds no job — the section shows "select a compatible 3D
    // vector field" instead of burning worker quadrature on a hidden,
    // necessarily-invalid result.
    if (field.dimension !== "3d") {
      return null;
    }
    const fieldIdentity = vectorCalculusSourceIdentity(field, paramKeys);
    if (fieldIdentity === null) {
      return null;
    }
    fieldPayload = { dimension: field.dimension, pExpr: field.pExpr, qExpr: field.qExpr, rExpr: field.rExpr };
    fieldStructure = fieldIdentity;
  }

  // S25-R1: mode leads the signature. Without it, arcLength and
  // scalarLine (same integrand) — or surfaceArea and scalarSurface —
  // collide: mode switches enqueue 0 jobs and stale numbers present as
  // current. Segments narrow per mode where the input is meaningless
  // (direction only matters for work, orientation only for flux,
  // integrand only for scalar modes), so unrelated edits never recompute.
  const segments = [config.mode, targetStructure, fieldStructure];
  if (config.mode === "scalarLine" || config.mode === "scalarSurface") {
    segments.push(`integrand:${config.scalarIntegrand}`);
  }
  segments.push(`quality:${config.quality}`);
  if (config.mode === "work") {
    segments.push(`direction:${config.direction}`);
  }
  if (config.mode === "flux") {
    segments.push(`orientation:${config.orientationSign}`);
  }
  segments.push(getParamScopeSignature(params));
  const signature = segments.join("|");
  return {
    jobId: integralResultKey(config.sourceId),
    payload: {
      mode: config.mode,
      target: targetPayload,
      scalarIntegrand: config.scalarIntegrand,
      field: fieldPayload,
      quality: config.quality,
      direction: config.direction,
      orientationSign: config.orientationSign
    },
    signature
  };
}

export interface IntegralSyncContext {
  manager: GeometryComputeManager;
  lastRequested: Map<string, string>;
}

// Pure request pump: requests only when the composite signature differs
// from the last request for that namespaced id. Colors, visibility,
// wireframe, tessellation, S20–S24 analysis state, workspace, camera,
// view, layout, and theme never enter signatures (PART 40: 0 jobs).
export function pumpIntegralJobs(
  context: IntegralSyncContext,
  jobs: (IntegralJob | null)[],
  params: Record<string, number>,
  liveJobIds: Set<string>
): void {
  for (const [jobId] of context.lastRequested) {
    if (!liveJobIds.has(jobId)) {
      context.lastRequested.delete(jobId);
    }
  }
  for (const job of jobs) {
    if (!job) {
      continue;
    }
    if (context.lastRequested.get(job.jobId) === job.signature) {
      continue;
    }
    context.lastRequested.set(job.jobId, job.signature);
    context.manager.requestCompute({
      objectId: job.jobId,
      kind: "integralAnalysis",
      payload: job.payload,
      params,
      structure: job.signature
    });
  }
}

// Applier backstop (runs inside the shared manager's onResult, which
// already enforces generation freshness). Rebuilds the desired job from
// live objects+config and discards on ANY mismatch — the S19 C2 rule
// generalized to multi-source analysis (PART 18). Returns true when a
// terminal analysis outcome was stored.
export function applyIntegralResponse(
  response: GeometryComputeResponse,
  objects: readonly GraphObject[],
  configs: Record<string, IntegralAnalysisConfig>,
  params: Record<string, number>
): boolean {
  if (response.kind !== "integralAnalysis") {
    return false;
  }
  if (!response.objectId.startsWith("integral:")) {
    return false;
  }
  const sourceId = response.objectId.slice("integral:".length);
  const config = configs[sourceId];
  if (!config) {
    return false;
  }
  const desired = buildIntegralJob(objects, config, params);
  if (!desired || desired.signature !== response.structure) {
    return false;
  }
  // The manager validated the response shape (isGeometryComputeResponse)
  // before onResult ran, so these casts restate the guard, not new trust.
  const store = useIntegralResultsStore.getState();
  const result = response.result;
  if (result.status === "ok") {
    store.setResult(response.objectId, {
      signature: response.structure,
      result: result as IntegralAnalysisOkResult
    });
    return true;
  }
  if (result.status === "invalid" || result.status === "unsupported") {
    store.setResult(response.objectId, {
      signature: response.structure,
      result: result as IntegralAnalysisNonOkResult
    });
    return true;
  }
  // error/budget-exceeded: the manager status message carries the display;
  // nothing stable to store.
  return false;
}

let integralManager: GeometryComputeManager | null = null;

function createIntegralTransport(): GeometryWorkerTransport {
  const worker = new Worker(new URL("../../workers/geometryComputeWorker.ts", import.meta.url), {
    type: "module"
  });
  return {
    postRequest: (request) => {
      worker.postMessage(request);
    },
    setOnResponse: (handler) => {
      worker.onmessage = (event: MessageEvent) => handler(event.data);
    },
    setOnError: (handler) => {
      worker.onerror = (error) => handler(error);
    },
    terminate: () => {
      worker.terminate();
    }
  };
}

// Module-level integral manager: same worker file and protocol as
// geometry (extended kinds), independent instance because integral
// requests originate from the Inspector effect while the geometry
// manager lives inside the Three engine. Lazy: no worker thread exists
// until the first integral computation.
export function getIntegralComputeManager(
  applyResponse: (response: GeometryComputeResponse) => void = defaultApplyIntegralResponse
): GeometryComputeManager {
  if (!integralManager) {
    integralManager = createGeometryComputeManager({
      createTransport: createIntegralTransport,
      onResult: applyResponse
    });
  }
  return integralManager;
}

export function resetIntegralComputeManagerForTests(): void {
  integralManager = null;
  sharedSyncContext = null;
}

function defaultApplyIntegralResponse(response: GeometryComputeResponse): void {
  const graph = useGraphStore.getState();
  applyIntegralResponse(
    response,
    graph.scene.objects,
    graph.ui.integralAnalysisBySourceId,
    getEditorParameterScope()
  );
}

let sharedSyncContext: IntegralSyncContext | null = null;

// Shared shell context: one manager, one signature ledger.
export function getIntegralSyncContext(): IntegralSyncContext {
  if (!sharedSyncContext) {
    sharedSyncContext = { manager: getIntegralComputeManager(), lastRequested: new Map() };
  }
  return sharedSyncContext;
}

// Shell entry point: housekeeping (missing-target clears, dangling field
// selections, dead-result pruning, dead-job notification) plus
// desired-job pumping. Safe to call on every Inspector render: signature
// tracking makes unrelated changes enqueue 0 jobs.
export function syncIntegralAnalysis(
  context: IntegralSyncContext,
  objects: readonly GraphObject[],
  params: Record<string, number>
): void {
  const graph = useGraphStore.getState();
  const configs = graph.ui.integralAnalysisBySourceId;
  const liveJobIds = new Set<string>();
  const jobs: (IntegralJob | null)[] = [];
  for (const [sourceId, config] of Object.entries(configs)) {
    const target = objects.find((object) => object.id === sourceId);
    if (!target) {
      graph.clearIntegralAnalysis(sourceId);
      useIntegralResultsStore.getState().removeForSource(sourceId);
      context.manager.notifyObjectsRemoved([integralResultKey(sourceId)]);
      context.lastRequested.delete(integralResultKey(sourceId));
      continue;
    }
    const compatible =
      (target.kind === "parametricCurve" && CURVE_MODES.includes(config.mode)) ||
      ((target.kind === "surface" || target.kind === "parametricSurface") &&
        SURFACE_MODES.includes(config.mode));
    if (!compatible) {
      graph.clearIntegralAnalysis(sourceId);
      useIntegralResultsStore.getState().removeForSource(sourceId);
      context.manager.notifyObjectsRemoved([integralResultKey(sourceId)]);
      context.lastRequested.delete(integralResultKey(sourceId));
      continue;
    }
    const job = buildIntegralJob(objects, config, params);
    if (job) {
      liveJobIds.add(job.jobId);
      jobs.push(job);
    }
  }
  // Dangling field selections: the referenced field is gone, stopped
  // being a vector field, or became 2D (delete/kind-switch/dimension
  // backstop; commit-time pruning covers the synchronous path). The stale
  // result is dropped with the selection so no hidden entry lingers.
  for (const [sourceId, config] of Object.entries(useGraphStore.getState().ui.integralAnalysisBySourceId)) {
    if (!config.vectorFieldId) {
      continue;
    }
    const field = objects.find((object) => object.id === config.vectorFieldId);
    if (!field || field.kind !== "vectorField" || field.dimension !== "3d") {
      useGraphStore.getState().setIntegralConfig(sourceId, { vectorFieldId: null });
      useIntegralResultsStore.getState().removeForSource(sourceId);
    }
  }
  // Drop results whose config vanished.
  const results = useIntegralResultsStore.getState();
  const liveConfigs = useGraphStore.getState().ui.integralAnalysisBySourceId;
  for (const key of Object.keys(results.entries)) {
    const sourceId = key.startsWith("integral:") ? key.slice("integral:".length) : null;
    if (sourceId !== null && !liveConfigs[sourceId]) {
      results.removeForSource(sourceId);
    }
  }
  // Dead job cleanup: tracked ids with no live job stop occupying the
  // manager (covers toggle-off mid-flight and deleted sources).
  for (const trackedId of context.manager.getTrackedObjectIds()) {
    if (trackedId.startsWith("integral:") && !liveJobIds.has(trackedId)) {
      context.manager.notifyObjectsRemoved([trackedId]);
      context.lastRequested.delete(trackedId);
    }
  }
  pumpIntegralJobs(context, jobs, params, liveJobIds);
}

// Test seam: synchronous in-process transport running the pure worker
// handler through the REAL manager path (generations, statuses, onResult
// applier), mirroring the S19/S23/S24 fake-transport test pattern.
export function createIntegralSyncTestContext(
  onResult: (response: GeometryComputeResponse) => void = () => {}
): IntegralSyncContext & {
  requests: { objectId: string; kind: string; structure: string }[];
} {
  const requests: { objectId: string; kind: string; structure: string }[] = [];
  let responseHandler: ((response: unknown) => void) | null = null;
  const manager = createGeometryComputeManager({
    createTransport: () => ({
      postRequest: (request) => {
        requests.push({ objectId: request.objectId, kind: request.kind, structure: request.structure });
        const handled = handleGeometryComputeMessage(request);
        if (handled && responseHandler) {
          responseHandler(handled.response);
        }
      },
      setOnResponse: (handler) => {
        responseHandler = handler;
      },
      setOnError: () => {},
      terminate: () => {}
    }),
    onResult
  });
  return { manager, lastRequested: new Map(), requests };
}
