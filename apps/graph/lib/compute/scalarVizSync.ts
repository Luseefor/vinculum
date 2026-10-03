import type { GraphObject, ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { DEFAULT_SCALAR_GRID_RESOLUTION, DEFAULT_SLICE_GRID_RESOLUTION } from "@/lib/math/scalarFieldSample";
import { DEFAULT_CONTOUR_COUNT } from "@/lib/math/marchingSquares";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { getParamScopeSignature } from "@/lib/math/paramScope";
import { useGraphStore } from "@/store/graphStore";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import type { ScalarVizConfig } from "@/types/graphUi";
import {
  createGeometryComputeManager,
  type GeometryComputeManager,
  type GeometryWorkerTransport
} from "./geometryComputeManager";
import type {
  GeometryComputeResponse,
  ScalarFieldComputePayload,
  ScalarSlicePlane
} from "./geometryComputeProtocol";
import {
  scalarVizFieldKey,
  scalarVizSliceKey,
  useScalarVizResultsStore
} from "./scalarVizResults";

// S23 scalar-viz request/applier layer over the shared S19 manager +
// protocol. One module-level manager (same worker file, extended kinds —
// NOT a separate scalar worker implementation) serves both the 2D canvas
// effect and the 3D tick; per-(namespaced-id) generations plus the echoed
// structure backstop give scalar jobs the exact S19 race model.
//
// Namespacing: field jobs use `scalar:<sourceId>`, slice jobs
// `slice:<sourceId>`, so scalar generations/queues/statuses never collide
// with the source's own geometry jobs. The applier writes the transient
// result cache; renderers (2D canvas, 3D slice sync) read it. No Three,
// no DOM, no React here — the manager transport is injected for tests.

export interface ScalarVizJob {
  jobId: string;
  payload: ScalarFieldComputePayload;
  /** Full recompute identity: math structure + numerics + param values. */
  signature: string;
}

export function scalarFieldDomainOf(source: SurfaceGraphObject): {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
} {
  // Mirrors sampleSurface: the object's x/y ranges always span the two
  // independent variables, whatever the orientation names them.
  return {
    uMin: source.domain.xMin,
    uMax: source.domain.xMax,
    vMin: source.domain.yMin,
    vMax: source.domain.yMax
  };
}

export function scalarSliceDomainOf(source: ImplicitSurfaceObject, plane: ScalarSlicePlane): {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
} {
  // Project the volumetric domain onto the chosen plane (PART: slice
  // domain). Never invent infinite extents.
  if (plane === "xy") {
    return { uMin: source.domain.xMin, uMax: source.domain.xMax, vMin: source.domain.yMin, vMax: source.domain.yMax };
  }
  if (plane === "xz") {
    return { uMin: source.domain.xMin, uMax: source.domain.xMax, vMin: source.domain.zMin, vMax: source.domain.zMax };
  }
  return { uMin: source.domain.yMin, uMax: source.domain.yMax, vMin: source.domain.zMin, vMax: source.domain.zMax };
}

// Desired 2D-field job for a source+config, or null when no computation
// is needed (visualization disabled) or the source cannot supply one.
// Pure: safe to call every frame; the caller requests only on signature
// change, so camera/view/layout/theme changes enqueue 0 jobs.
export function buildScalarFieldJob(
  source: GraphObject,
  config: ScalarVizConfig | undefined,
  params: Record<string, number>
): ScalarVizJob | null {
  if (!config || source.kind !== "surface" || source.id !== config.sourceId) {
    return null;
  }
  if (!config.showHeatmap && !config.showContours && !config.showGradient) {
    return null;
  }
  const liveIdentity = scalarVizMathIdentity(source, Object.keys(params));
  if (liveIdentity === null || liveIdentity !== config.structure) {
    return null;
  }
  const contourCount = Math.floor(config.contourCount);
  const gradientDensity = config.showGradient ? Math.floor(config.gradientDensity) : 0;
  const fieldDomain = scalarFieldDomainOf(source);
  if (
    !Number.isFinite(fieldDomain.uMin) ||
    !Number.isFinite(fieldDomain.uMax) ||
    !Number.isFinite(fieldDomain.vMin) ||
    !Number.isFinite(fieldDomain.vMax)
  ) {
    return null;
  }
  const payload: ScalarFieldComputePayload = {
    source: { kind: "surface", equation: source.equation, orientation: source.orientation ?? "z" },
    target: { kind: "domain2D", domain: fieldDomain },
    resolution: DEFAULT_SCALAR_GRID_RESOLUTION,
    contourCount: config.showContours ? contourCount : 0,
    gradientDensity
  };
  // S23-R1: signature derives from the PASSED params (pure, test-seam
  // safe), never ambient store reads — production callers pass the live
  // editor scope, so behavior is identical.
  const signature = [
    config.structure,
    getParamScopeSignature(params),
    `contours:${config.showContours ? contourCount : 0}`,
    `gradient:${gradientDensity}`
  ].join("|");
  return { jobId: scalarVizFieldKey(source.id), payload, signature };
}

// Desired slice job, or null when disabled/inapplicable. The slice value
// must lie inside the held-axis domain span (else the Inspector shows
// "outside" and no job runs).
export function buildScalarSliceJob(
  source: GraphObject,
  config: ScalarVizConfig | undefined,
  params: Record<string, number>
): ScalarVizJob | null {
  if (!config || source.kind !== "implicitSurface" || source.id !== config.sourceId) {
    return null;
  }
  if (!config.sliceEnabled) {
    return null;
  }
  const liveIdentity = scalarVizMathIdentity(source, Object.keys(params));
  if (liveIdentity === null || liveIdentity !== config.structure) {
    return null;
  }
  const plane = config.slicePlane;
  const held =
    plane === "xy"
      ? { min: source.domain.zMin, max: source.domain.zMax }
      : plane === "xz"
        ? { min: source.domain.yMin, max: source.domain.yMax }
        : { min: source.domain.xMin, max: source.domain.xMax };
  if (!Number.isFinite(held.min) || !Number.isFinite(held.max)) {
    return null;
  }
  const lo = Math.min(held.min, held.max);
  const hi = Math.max(held.min, held.max);
  if (!(config.sliceValue >= lo && config.sliceValue <= hi)) {
    return null;
  }
  // S23-R1: explicit (u, v) domain gate — non-finite plane extents take
  // the no-job path here instead of dying silently in the worker guard.
  const planeDomain = scalarSliceDomainOf(source, plane);
  if (
    !Number.isFinite(planeDomain.uMin) ||
    !Number.isFinite(planeDomain.uMax) ||
    !Number.isFinite(planeDomain.vMin) ||
    !Number.isFinite(planeDomain.vMax)
  ) {
    return null;
  }
  const payload: ScalarFieldComputePayload = {
    source: { kind: "implicit", equation: source.equation },
    target: { kind: "slice", plane, planeValue: config.sliceValue, domain: planeDomain },
    resolution: DEFAULT_SLICE_GRID_RESOLUTION,
    contourCount: config.showSliceContours ? DEFAULT_CONTOUR_COUNT : 0,
    gradientDensity: 0
  };
  const signature = [
    config.structure,
    getParamScopeSignature(params),
    `slice:${plane}@${config.sliceValue}`,
    `sliceContours:${config.showSliceContours ? 1 : 0}`
  ].join("|");
  return { jobId: scalarVizSliceKey(source.id), payload, signature };
}

export interface ScalarVizSyncContext {
  manager: GeometryComputeManager;
  lastRequested: Map<string, string>;
}

// Pure request pump over desired jobs: requests only when the signature
// differs from the last request for that namespaced id. Theme, color,
// visibility, workspace, camera, view, and layout never enter signatures
// (PART 35: 0 jobs). Stale signatures are forgotten so deleted-source
// entries cannot accumulate.
export function pumpScalarVizJobs(
  context: ScalarVizSyncContext,
  jobs: (ScalarVizJob | null)[],
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
      kind: "scalarField",
      payload: job.payload,
      params,
      structure: job.signature
    });
  }
}

// Applier backstop for scalar responses (runs inside the shared manager's
// onResult, which already enforces generation freshness). Recomputes the
// desired job for the live source+config and discards on ANY mismatch:
// same-ID-different-content (expression edits, contour-count changes,
// slice moves, parameter edits racing the response) can never paint stale
// data. Returns true when the result was stored.
export function applyScalarVizResponse(
  response: GeometryComputeResponse,
  objects: readonly GraphObject[],
  configs: Record<string, ScalarVizConfig>,
  params: Record<string, number>
): boolean {
  if (response.kind !== "scalarField") {
    return false;
  }
  const store = useScalarVizResultsStore.getState();
  const isSlice = response.objectId.startsWith("slice:");
  const sourceId = isSlice
    ? response.objectId.slice("slice:".length)
    : response.objectId.startsWith("scalar:")
      ? response.objectId.slice("scalar:".length)
      : null;
  if (sourceId === null) {
    return false;
  }
  const source = objects.find((object) => object.id === sourceId);
  const config = configs[sourceId];
  if (!source || !config) {
    return false;
  }
  const desired = isSlice ? buildScalarSliceJob(source, config, params) : buildScalarFieldJob(source, config, params);
  if (!desired || desired.signature !== response.structure) {
    return false;
  }
  if (response.result.status === "ok" && "values" in response.result) {
    store.setResult(response.objectId, { signature: response.structure, result: response.result });
    return true;
  }
  if (response.result.status === "empty") {
    store.setResult(response.objectId, { signature: response.structure, result: { status: "empty" } });
    return true;
  }
  return false;
}

let scalarManager: GeometryComputeManager | null = null;

function createScalarTransport(): GeometryWorkerTransport {
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

// Module-level scalar manager: same worker file and protocol as geometry
// (extended kinds), independent instance because scalar requests originate
// from the 2D canvas effect as well as the 3D tick, while the geometry
// manager lives inside the Three engine. Lazy: no worker thread exists
// until the first scalar visualization is enabled. Completion-time state
// is read live (structure backstop); the optional applier hook exists for
// tests and alternate shells.
export function getScalarComputeManager(
  applyResponse: (response: GeometryComputeResponse) => void = defaultApplyScalarResponse
): GeometryComputeManager {
  if (!scalarManager) {
    scalarManager = createGeometryComputeManager({
      createTransport: createScalarTransport,
      onResult: applyResponse
    });
  }
  return scalarManager;
}

export function resetScalarComputeManagerForTests(): void {
  scalarManager = null;
  sharedSyncContext = null;
}

let sharedSyncContext: ScalarVizSyncContext | null = null;

// Shared shell context (2D canvas effect + 3D tick): one manager, one
// signature ledger, so duplicate callers never double-request.
export function getScalarSyncContext(): ScalarVizSyncContext {
  if (!sharedSyncContext) {
    sharedSyncContext = { manager: getScalarComputeManager(), lastRequested: new Map() };
  }
  return sharedSyncContext;
}

function defaultApplyScalarResponse(response: GeometryComputeResponse): void {
  // Live applier: reads store state at completion time (structure
  // backstop). Import direction is acyclic (graphStore never imports this
  // module; slices import only the results store).
  const graph = useGraphStore.getState();
  applyScalarVizResponse(
    response,
    graph.scene.objects,
    graph.ui.scalarVizBySourceId,
    getEditorParameterScope()
  );
}

// Shell entry point: housekeeping (stale-config clears, dead-result
// pruning, dead-job notification) plus desired-job pumping. Pure-safe to
// call every frame and from canvas effects: signature tracking makes
// camera/view/layout/theme/workspace changes enqueue 0 jobs.
export function syncScalarViz(
  context: ScalarVizSyncContext,
  objects: readonly GraphObject[],
  params: Record<string, number>
): void {
  const graph = useGraphStore.getState();
  const configs = graph.ui.scalarVizBySourceId;
  const paramKeys = Object.keys(params);
  const liveJobIds = new Set<string>();
  const jobs: (ScalarVizJob | null)[] = [];
  for (const [sourceId, config] of Object.entries(configs)) {
    const source = objects.find((object) => object.id === sourceId);
    const liveIdentity = source ? scalarVizMathIdentity(source, paramKeys) : null;
    if (!source || liveIdentity === null || liveIdentity !== config.structure) {
      // Delete/kind-switch/param-keys drift backstop (commit-time pruning
      // covers expression edits; this covers everything else).
      graph.clearScalarViz(sourceId);
      useScalarVizResultsStore.getState().removeForSource(sourceId);
      context.manager.notifyObjectsRemoved([scalarVizFieldKey(sourceId), scalarVizSliceKey(sourceId)]);
      context.lastRequested.delete(scalarVizFieldKey(sourceId));
      context.lastRequested.delete(scalarVizSliceKey(sourceId));
      continue;
    }
    const fieldJob = buildScalarFieldJob(source, config, params);
    const sliceJob = buildScalarSliceJob(source, config, params);
    if (fieldJob) {
      liveJobIds.add(fieldJob.jobId);
      jobs.push(fieldJob);
    }
    if (sliceJob) {
      liveJobIds.add(sliceJob.jobId);
      jobs.push(sliceJob);
    }
  }
  // Drop results whose config vanished (toggle-off keeps the config with
  // flags false, so this only fires on clears).
  const results = useScalarVizResultsStore.getState();
  for (const key of Object.keys(results.entries)) {
    const sourceId = key.startsWith("slice:")
      ? key.slice("slice:".length)
      : key.startsWith("scalar:")
        ? key.slice("scalar:".length)
        : null;
    if (sourceId !== null && !configs[sourceId]) {
      results.removeForSource(sourceId);
    }
  }
  // Dead job cleanup: tracked ids with no live job stop occupying the
  // manager (covers toggle-off mid-flight and deleted sources).
  for (const trackedId of context.manager.getTrackedObjectIds()) {
    if (
      (trackedId.startsWith("scalar:") || trackedId.startsWith("slice:")) &&
      !liveJobIds.has(trackedId)
    ) {
      context.manager.notifyObjectsRemoved([trackedId]);
      context.lastRequested.delete(trackedId);
    }
  }
  pumpScalarVizJobs(context, jobs, params, liveJobIds);
}

// Test seam: synchronous in-process transport running the pure worker
// handler through the REAL manager path (generations, statuses, onResult
// applier), mirroring the S19 fake-transport test pattern.
export function createScalarSyncTestContext(
  onResult: (response: GeometryComputeResponse) => void = () => {}
): ScalarVizSyncContext & {
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
