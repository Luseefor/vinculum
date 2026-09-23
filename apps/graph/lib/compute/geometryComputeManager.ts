import { reportWarning } from "@/lib/monitoring/errorReporting";
import {
  isGeometryComputeResponse,
  type GeometryComputeKind,
  type GeometryComputeRequest,
  type GeometryComputeResponse,
  type ImplicitSurfaceComputePayload,
  type ParametricSurfaceComputePayload
} from "./geometryComputeProtocol";
import { useGeometryComputeStore } from "./geometryComputeStatus";

// Transport abstraction over the real Web Worker (PART 30). Production
// passes a Worker-backed transport; unit tests inject a fake. The manager
// never depends on test globals.
export interface GeometryWorkerTransport {
  postRequest: (request: GeometryComputeRequest) => void;
  setOnResponse: (handler: (response: unknown) => void) => void;
  setOnError: (handler: (error: unknown) => void) => void;
  terminate: () => void;
}

// One dedicated geometry worker (S19 pool decision: a single worker.
// Typical scenes hold few heavy objects; per-object queue coalescing bounds
// wasted work, and serial execution keeps per-object completion order simple
// (cross-object completion order is timing-dependent and handled purely by
// generation equality, never by arrival order). A larger pool is not
// justified at current workload scale.)
//
// Responsibilities:
// - lazy worker creation on first request (no startup cost otherwise)
// - per-object monotonically increasing generations
// - per-object queue coalescing (newest relevant request wins; obsolete
//   queued versions never run)
// - stale-response suppression (generation match required; completion order
//   irrelevant)
// - crash recovery (terminate, clear in-flight ownership, error-mark
//   affected objects; the next edit lazily creates a fresh worker)
// - transient compute-status bookkeeping (pending/error only)
//
// Deliberately NOT tracked: scene epoch. Per-object generations plus
// prune-drop on removal cover rapid edits, out-of-order responses, deletion,
// undo/redo, scene replacement, and multi-object routing — with one
// caveat documented below. Serial worker execution keeps the *queue*
// deterministic (one job runs at a time, FIFO across objects); completion
// order across separate requests is inherently racy and handled purely by
// generation equality, never by arrival order.
//
// Caveat (deferred-sync window): store updates only flag the scene dirty;
// the sync that bumps generations or drops entries runs on the next rAF
// tick, so a fast (<16ms) worker response can arrive first. Two guards cover
// it: (1) the applier recomputes the live object's structure signature and
// discards on mismatch with the response's echoed `structure`, so
// same-id-different-content can never apply a wrong mesh; (2) the applier
// returns early when the object is absent, so pre-prune deletions cannot
// resurrect. Generations remain the primary ordering mechanism; structure
// verification is the backstop for the pre-sync window.
export interface GeometryComputeManager {
  requestCompute: (
    input:
      | {
          objectId: string;
          kind: "implicitSurface";
          payload: ImplicitSurfaceComputePayload;
          params: Record<string, number>;
          structure: string;
        }
      | {
          objectId: string;
          kind: "parametricSurface";
          payload: ParametricSurfaceComputePayload;
          params: Record<string, number>;
          structure: string;
        }
  ) => { requestId: number; generation: number } | null;
  notifyObjectsRemoved: (objectIds: readonly string[]) => void;
  getPendingCount: () => number;
  getGeneration: (objectId: string) => number | null;
  getTrackedObjectIds: () => readonly string[];
  dispose: () => void;
}

export interface GeometryComputeManagerOptions {
  createTransport: () => GeometryWorkerTransport;
  onResult: (response: GeometryComputeResponse) => void;
}

export function createGeometryComputeManager(options: GeometryComputeManagerOptions): GeometryComputeManager {
  let transport: GeometryWorkerTransport | null = null;
  let transportFailed = false;
  let disposed = false;
  let requestIdCounter = 0;
  const generations = new Map<string, number>();
  const queued = new Map<string, GeometryComputeRequest>();
  let inFlight: GeometryComputeRequest | null = null;

  const ensureTransport = (): GeometryWorkerTransport | null => {
    if (disposed || transportFailed) {
      return null;
    }
    if (transport) {
      return transport;
    }
    try {
      const created = options.createTransport();
      created.setOnResponse((response: unknown) => handleResponse(response));
      created.setOnError((error: unknown) => handleTransportError(error));
      transport = created;
      return transport;
    } catch (error) {
      transportFailed = true;
      reportWarning("Geometry compute worker could not be created.", {
        featureArea: "3d-viewport",
        operation: "geometry-compute-worker-unavailable",
        details: { message: error instanceof Error ? error.message : String(error) }
      });
      return null;
    }
  };

  const pump = () => {
    if (disposed || inFlight || queued.size === 0) {
      return;
    }
    const nextEntry = queued.entries().next();
    if (nextEntry.done) {
      return;
    }
    const [objectId, request] = nextEntry.value;
    const active = ensureTransport();
    if (!active) {
      // Worker unavailable: mark error (honest state, no silent multi-second
      // synchronous fallback). Stays until the next edit re-requests.
      useGeometryComputeStore.getState().setStatus(objectId, "error", "Geometry compute is unavailable in this browser.");
      queued.delete(objectId);
      pump();
      return;
    }
    queued.delete(objectId);
    inFlight = request;
    try {
      active.postRequest(request);
    } catch (error) {
      // A throwing transport is treated like a crashed worker for this job,
      // then run through crash recovery (terminate + fresh worker on retry).
      inFlight = null;
      useGeometryComputeStore.getState().setStatus(objectId, "error", "Geometry compute failed; edit to retry.");
      handleTransportError(error);
    }
  };

  const handleResponse = (response: unknown) => {
    if (disposed) {
      return;
    }
    if (!isGeometryComputeResponse(response)) {
      // Undecodable response: the worker is misbehaving for this job.
      // Drop in-flight ownership (the worker already moved on), error-mark
      // the affected object, and keep the queue flowing on the same worker.
      const affected = inFlight ? [inFlight.objectId] : [];
      inFlight = null;
      for (const objectId of affected) {
        useGeometryComputeStore.getState().setStatus(objectId, "error", "Geometry compute returned invalid data.");
      }
      reportWarning("Geometry compute worker sent an undecodable response.", {
        featureArea: "3d-viewport",
        operation: "geometry-compute-bad-response"
      });
      pump();
      return;
    }
    if (!inFlight || inFlight.requestId !== response.requestId) {
      // Unknown or post-crash response: ignore.
      return;
    }
    inFlight = null;
    const latestGeneration = generations.get(response.objectId);
    if (latestGeneration === undefined || latestGeneration !== response.generation) {
      // Stale: superseded by a newer request, or the object was removed.
      // Never touch status here: a newer pending request (or nothing) owns it.
      pump();
      return;
    }
    if (response.result.status === "ok" || response.result.status === "empty") {
      useGeometryComputeStore.getState().clearStatus(response.objectId);
    } else {
      const message =
        response.result.status === "budget-exceeded"
          ? "Surface too complex at this resolution; lower it."
          : response.result.error;
      useGeometryComputeStore.getState().setStatus(response.objectId, "error", message);
      if (response.result.status === "budget-exceeded") {
        // S18 parity: budget aborts are reported, like the sync builder.
        reportWarning("Implicit surface extraction exceeded the triangle budget.", {
          featureArea: "3d-viewport",
          operation: "implicit-surface-budget-exceeded"
        });
      }
    }
    try {
      options.onResult(response);
    } catch (error) {
      reportWarning("Geometry compute result could not be applied.", {
        featureArea: "3d-viewport",
        operation: "geometry-compute-apply-failed",
        objectId: response.objectId,
        details: { message: error instanceof Error ? error.message : String(error) }
      });
    }
    pump();
  };

  const handleTransportError = (error: unknown) => {
    if (disposed) {
      return;
    }
    // Crash recovery: terminate the broken worker, drop in-flight ownership,
    // error-mark affected objects. No auto-retry (a poison input could crash
    // deterministically); the next user edit lazily creates a fresh worker.
    // B1: queued (not yet started) jobs are dropped with the queue, so they
    // must be error-marked too — otherwise their rows would show a stuck
    // pending dot with no job left to resolve it.
    const affected = [...queued.keys()];
    if (inFlight) {
      affected.unshift(inFlight.objectId);
    }
    try {
      transport?.terminate();
    } catch {
      // Termination itself must never throw outward.
    }
    transport = null;
    inFlight = null;
    queued.clear();
    for (const objectId of affected) {
      useGeometryComputeStore.getState().setStatus(objectId, "error", "Geometry compute failed; edit to retry.");
    }
    reportWarning("Geometry compute worker failed and was terminated.", {
      featureArea: "3d-viewport",
      operation: "geometry-compute-worker-crashed",
      details: { message: error instanceof Error ? error.message : String(error) }
    });
  };

  return {
    requestCompute: (input) => {
      if (disposed) {
        return null;
      }
      const generation = (generations.get(input.objectId) ?? 0) + 1;
      generations.set(input.objectId, generation);
      requestIdCounter += 1;
      const base = {
        requestId: requestIdCounter,
        objectId: input.objectId,
        generation,
        params: { ...input.params },
        structure: input.structure
      };
      // Branch so the discriminated union narrows kind+payload together.
      const request: GeometryComputeRequest =
        input.kind === "implicitSurface"
          ? { ...base, kind: input.kind, payload: input.payload }
          : { ...base, kind: input.kind, payload: input.payload };
      // Queue coalescing: at most one queued (not yet started) request per
      // object. A newer request replaces obsolete queued versions; the
      // in-flight request, if any, resolves via stale suppression.
      queued.set(input.objectId, request);
      useGeometryComputeStore.getState().setStatus(input.objectId, "pending");
      pump();
      // A null transport (construction failure, disposed) means the job can
      // never run; the error status set above explains the missing mesh.
      if (transportFailed || disposed) {
        return null;
      }
      return { requestId: request.requestId, generation };
    },

    notifyObjectsRemoved: (objectIds) => {
      for (const objectId of objectIds) {
        generations.delete(objectId);
        queued.delete(objectId);
        useGeometryComputeStore.getState().clearStatus(objectId);
      }
    },

    getPendingCount: () => queued.size + (inFlight ? 1 : 0),

    getGeneration: (objectId) => generations.get(objectId) ?? null,

    getTrackedObjectIds: () => [...generations.keys()],

    dispose: () => {
      disposed = true;
      try {
        transport?.terminate();
      } catch {
        // Termination itself must never throw outward.
      }
      transport = null;
      inFlight = null;
      queued.clear();
      generations.clear();
      useGeometryComputeStore.getState().clearAll();
    }
  };
}

// Real Worker-backed transport. The Worker instance is constructed by the
// caller with the canonical `new Worker(new URL(...))` pattern (kept inline
// at the call site so the bundler statically detects and bundles the worker
// entry; passing a pre-built URL through layers breaks detection and serves
// raw source instead).
export function createGeometryWorkerTransport(worker: Worker): GeometryWorkerTransport {
  let responseHandler: ((response: unknown) => void) | null = null;
  let errorHandler: ((error: unknown) => void) | null = null;
  worker.onmessage = (event: MessageEvent) => {
    responseHandler?.(event.data);
  };
  worker.onerror = (event: ErrorEvent) => {
    errorHandler?.(event.error ?? new Error(event.message));
  };
  return {
    postRequest: (request) => {
      // Requests carry plain data only (no buffers), so no transfer list is
      // needed here; transferables flow worker -> main only, in responses.
      worker.postMessage(request);
    },
    setOnResponse: (handler) => {
      responseHandler = handler;
    },
    setOnError: (handler) => {
      errorHandler = handler;
    },
    terminate: () => {
      worker.terminate();
    }
  };
}
