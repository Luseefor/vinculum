import type { GraphObject } from "@vinculum/scene/types";
import { getParamScopeSignature } from "@/lib/math/paramScope";
import { clampSeedDensity } from "@/lib/math/streamlineSeeds";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { useGraphStore } from "@/store/graphStore";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import type { StreamlineVizConfig } from "@/types/graphUi";
import {
  createGeometryComputeManager,
  type GeometryComputeManager,
  type GeometryWorkerTransport
} from "./geometryComputeManager";
import type { GeometryComputeResponse, StreamlineComputePayload } from "./geometryComputeProtocol";
import { streamlineResultKey, useStreamlineResultsStore } from "./streamlineResults";

// S24 streamline request/applier layer over the shared S19 manager +
// protocol (S23 scalarVizSync pattern). One module-level manager (same
// worker file, extended kinds — NOT a separate streamline worker or
// manager implementation) serves the 2D canvas effect and the 3D tick;
// per-namespaced-id generations plus the echoed-structure backstop give
// streamline jobs the exact S19 race model.
//
// Namespacing: jobs use `streamline:<sourceId>`, so streamline
// generations/queues/statuses never collide with the source's own
// geometry jobs. The applier writes the transient result cache;
// renderers (2D canvas, 3D overlay sync) read it. No Three, no DOM, no
// React here.

export interface StreamlineJob {
  jobId: string;
  payload: StreamlineComputePayload;
  /** Full recompute identity: math structure + numerics + param values. */
  signature: string;
}

// Desired streamline job for a source+config, or null when no computation
// is needed (visualization disabled) or the config is stale. Pure: safe
// to call every frame; the caller requests only on signature change, so
// camera/view/layout/theme/glyph-appearance changes enqueue 0 jobs.
export function buildStreamlineJob(
  source: GraphObject,
  config: StreamlineVizConfig | undefined,
  params: Record<string, number>
): StreamlineJob | null {
  if (!config || source.kind !== "vectorField" || source.id !== config.sourceId) {
    return null;
  }
  if (!config.enabled) {
    return null;
  }
  const liveIdentity = vectorCalculusSourceIdentity(source, Object.keys(params));
  if (liveIdentity === null || liveIdentity !== config.structure) {
    return null;
  }
  const domain = source.domain;
  if (
    !Number.isFinite(domain.xMin) ||
    !Number.isFinite(domain.xMax) ||
    !Number.isFinite(domain.yMin) ||
    !Number.isFinite(domain.yMax) ||
    (source.dimension === "3d" &&
      (!Number.isFinite(source.domain.zMin) || !Number.isFinite(source.domain.zMax)))
  ) {
    return null;
  }
  const payload: StreamlineComputePayload = {
    dimension: source.dimension,
    pExpr: source.pExpr,
    qExpr: source.qExpr,
    rExpr: source.rExpr,
    domain,
    seedDensity: clampSeedDensity(config.seedDensity, source.dimension),
    length: config.length,
    quality: config.quality
  };
  const signature = [
    config.structure,
    getParamScopeSignature(params),
    `seeds:${payload.seedDensity}`,
    `length:${config.length}`,
    `quality:${config.quality}`
  ].join("|");
  return { jobId: streamlineResultKey(source.id), payload, signature };
}

export interface StreamlineSyncContext {
  manager: GeometryComputeManager;
  lastRequested: Map<string, string>;
}

// Pure request pump over desired jobs: requests only when the signature
// differs from the last request for that namespaced id. Glyph density /
// scale / normalize / color, visibility, theme, camera, view, layout, and
// workspace never enter signatures (PART 11: 0 jobs). Stale signatures
// are forgotten so deleted-source entries cannot accumulate.
export function pumpStreamlineJobs(
  context: StreamlineSyncContext,
  jobs: (StreamlineJob | null)[],
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
      kind: "streamlines",
      payload: job.payload,
      params,
      structure: job.signature
    });
  }
}

// Applier backstop for streamline responses (runs inside the shared
// manager's onResult, which already enforces generation freshness).
// Rebuilds the desired job for the live source+config and discards on ANY
// mismatch: same-ID-different-content (expression edits, density changes,
// parameter edits racing the response) can never paint stale lines.
// Returns true when the result was stored.
export function applyStreamlineResponse(
  response: GeometryComputeResponse,
  objects: readonly GraphObject[],
  configs: Record<string, StreamlineVizConfig>,
  params: Record<string, number>
): boolean {
  if (response.kind !== "streamlines") {
    return false;
  }
  if (!response.objectId.startsWith("streamline:")) {
    return false;
  }
  const sourceId = response.objectId.slice("streamline:".length);
  const source = objects.find((object) => object.id === sourceId);
  const config = configs[sourceId];
  if (!source || !config) {
    return false;
  }
  const desired = buildStreamlineJob(source, config, params);
  if (!desired || desired.signature !== response.structure) {
    return false;
  }
  const store = useStreamlineResultsStore.getState();
  if (response.result.status === "ok" && "offsets" in response.result) {
    store.setResult(response.objectId, { signature: response.structure, result: response.result });
    return true;
  }
  if (response.result.status === "empty") {
    store.setResult(response.objectId, { signature: response.structure, result: { status: "empty" } });
    return true;
  }
  return false;
}

let streamlineManager: GeometryComputeManager | null = null;

function createStreamlineTransport(): GeometryWorkerTransport {
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

// Module-level streamline manager: same worker file and protocol as
// geometry (extended kinds), independent instance because streamline
// requests originate from the 2D canvas effect as well as the 3D tick,
// while the geometry manager lives inside the Three engine. Lazy: no
// worker thread exists until streamlines are first enabled.
export function getStreamlineComputeManager(
  applyResponse: (response: GeometryComputeResponse) => void = defaultApplyStreamlineResponse
): GeometryComputeManager {
  if (!streamlineManager) {
    streamlineManager = createGeometryComputeManager({
      createTransport: createStreamlineTransport,
      onResult: applyResponse
    });
  }
  return streamlineManager;
}

export function resetStreamlineComputeManagerForTests(): void {
  streamlineManager = null;
  sharedSyncContext = null;
}

function defaultApplyStreamlineResponse(response: GeometryComputeResponse): void {
  const graph = useGraphStore.getState();
  applyStreamlineResponse(
    response,
    graph.scene.objects,
    graph.ui.streamlineVizBySourceId,
    getEditorParameterScope()
  );
}

let sharedSyncContext: StreamlineSyncContext | null = null;

// Shared shell context (2D canvas effect + 3D tick): one manager, one
// signature ledger, so duplicate callers never double-request.
export function getStreamlineSyncContext(): StreamlineSyncContext {
  if (!sharedSyncContext) {
    sharedSyncContext = { manager: getStreamlineComputeManager(), lastRequested: new Map() };
  }
  return sharedSyncContext;
}

// Shell entry point: housekeeping (stale-config clears, dead-result
// pruning, dead-job notification) plus desired-job pumping. Safe to call
// every frame and from canvas effects: signature tracking makes
// camera/view/layout/theme/workspace changes enqueue 0 jobs.
export function syncStreamlines(
  context: StreamlineSyncContext,
  objects: readonly GraphObject[],
  params: Record<string, number>
): void {
  const graph = useGraphStore.getState();
  const configs = graph.ui.streamlineVizBySourceId;
  const paramKeys = Object.keys(params);
  const liveJobIds = new Set<string>();
  const jobs: (StreamlineJob | null)[] = [];
  for (const [sourceId, config] of Object.entries(configs)) {
    const source = objects.find((object) => object.id === sourceId);
    const liveIdentity = source ? vectorCalculusSourceIdentity(source, paramKeys) : null;
    if (!source || liveIdentity === null || liveIdentity !== config.structure) {
      // Delete/kind-switch/param-keys drift backstop (commit-time pruning
      // covers expression edits; this covers everything else).
      graph.clearStreamline(sourceId);
      useStreamlineResultsStore.getState().removeForSource(sourceId);
      context.manager.notifyObjectsRemoved([streamlineResultKey(sourceId)]);
      context.lastRequested.delete(streamlineResultKey(sourceId));
      continue;
    }
    const job = buildStreamlineJob(source, config, params);
    if (job) {
      liveJobIds.add(job.jobId);
      jobs.push(job);
    }
  }
  // Drop results whose config vanished (toggle-off keeps the config with
  // enabled:false, so this only fires on clears).
  const results = useStreamlineResultsStore.getState();
  for (const key of Object.keys(results.entries)) {
    const sourceId = key.startsWith("streamline:") ? key.slice("streamline:".length) : null;
    if (sourceId !== null && !configs[sourceId]) {
      results.removeForSource(sourceId);
    }
  }
  // Dead job cleanup: tracked ids with no live job stop occupying the
  // manager (covers toggle-off mid-flight and deleted sources).
  for (const trackedId of context.manager.getTrackedObjectIds()) {
    if (trackedId.startsWith("streamline:") && !liveJobIds.has(trackedId)) {
      context.manager.notifyObjectsRemoved([trackedId]);
      context.lastRequested.delete(trackedId);
    }
  }
  pumpStreamlineJobs(context, jobs, params, liveJobIds);
}

// Test seam: synchronous in-process transport running the pure worker
// handler through the REAL manager path (generations, statuses, onResult
// applier), mirroring the S19/S23 fake-transport test pattern.
export function createStreamlineSyncTestContext(
  onResult: (response: GeometryComputeResponse) => void = () => {}
): StreamlineSyncContext & {
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
