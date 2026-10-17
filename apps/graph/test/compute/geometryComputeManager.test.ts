import { beforeEach, describe, expect, it } from "vitest";
import {
  createGeometryComputeManager,
  type GeometryComputeManager,
  type GeometryWorkerTransport
} from "@/lib/compute/geometryComputeManager";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import type {
  GeometryComputeRequest,
  GeometryComputeResponse
} from "@/lib/compute/geometryComputeProtocol";

interface FakeTransport extends GeometryWorkerTransport {
  posted: GeometryComputeRequest[];
  terminated: boolean;
  respond: (response: unknown) => void;
  fail: (error: unknown) => void;
}

function createFakeTransport(): FakeTransport {
  let responseHandler: ((response: unknown) => void) | null = null;
  let errorHandler: ((error: unknown) => void) | null = null;
  const fake: FakeTransport = {
    posted: [],
    terminated: false,
    postRequest: (request) => {
      fake.posted.push(request);
    },
    setOnResponse: (handler) => {
      responseHandler = handler;
    },
    setOnError: (handler) => {
      errorHandler = handler;
    },
    terminate: () => {
      fake.terminated = true;
    },
    respond: (response: unknown) => {
      responseHandler?.(response);
    },
    fail: (error: unknown) => {
      errorHandler?.(error);
    }
  };
  return fake;
}

const IMPLICIT_PAYLOAD = {
  equation: "x^2 + y^2 + z^2 = 1",
  domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
  resolution: 16
};

function okResponse(request: GeometryComputeRequest): GeometryComputeResponse {
  return {
    requestId: request.requestId,
    objectId: request.objectId,
    generation: request.generation,
    kind: request.kind,
    structure: request.structure,
    result: {
      status: "ok",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      rejectedTriangles: 0
    }
  };
}

describe("geometryComputeManager", () => {
  let fake: FakeTransport;
  let manager: GeometryComputeManager;
  let results: GeometryComputeResponse[];
  let createTransportCalls: number;

  beforeEach(() => {
    useGeometryComputeStore.getState().clearAll();
    fake = createFakeTransport();
    results = [];
    createTransportCalls = 0;
    manager = createGeometryComputeManager({
      createTransport: () => {
        createTransportCalls += 1;
        return fake;
      },
      onResult: (response) => {
        results.push(response);
      }
    });
  });

  it("creates the transport lazily on first request only", () => {
    expect(createTransportCalls).toBe(0);
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(createTransportCalls).toBe(1);
    manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(createTransportCalls).toBe(1);
    expect(fake.posted).toHaveLength(1);
  });

  it("bumps generations per object independently", () => {
    const first = manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    const second = manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    const other = manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(first?.generation).toBe(1);
    expect(second?.generation).toBe(2);
    expect(other?.generation).toBe(1);
    expect(manager.getGeneration("a")).toBe(2);
    expect(manager.getGeneration("missing")).toBeNull();
  });

  it("marks pending on request and clears on accepted ok result", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("pending");
    fake.respond(okResponse(fake.posted[0]!));
    expect(results).toHaveLength(1);
    expect(useGeometryComputeStore.getState().entries["a"]).toBeUndefined();
    expect(manager.getPendingCount()).toBe(0);
  });

  it("coalesces rapid edits: only first and newest run, intermediates never post", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    // First posted immediately; second coalesced away, third queued.
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(2);
    // The in-flight first request is now stale (gen 3 is newest): its
    // response is discarded, which frees the worker for the queued newest.
    fake.respond(okResponse(fake.posted[0]!));
    expect(results).toHaveLength(0);
    expect(fake.posted).toHaveLength(2);
    expect(fake.posted[1]!.generation).toBe(3);
    // Newest completes and applies.
    fake.respond(okResponse(fake.posted[1]!));
    expect(results).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(0);
  });

  it("rejects stale out-of-order responses without touching status", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    const first = fake.posted[0]!;
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    // Stale gen-1 response arrives after gen-2 was enqueued.
    fake.respond(okResponse(first));
    expect(results).toHaveLength(0);
    // Newer pending request still owns the status, and its job was posted
    // as the worker freed up.
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("pending");
    expect(fake.posted).toHaveLength(2);
    expect(fake.posted[1]!.generation).toBe(2);
    expect(manager.getPendingCount()).toBe(1);
  });

  it("ignores responses with unknown request ids", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    fake.respond({ ...okResponse(fake.posted[0]!), requestId: 999 });
    expect(results).toHaveLength(0);
    expect(manager.getPendingCount()).toBe(1);
  });

  it("ignores undecodable responses without wedging the queue", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    fake.respond({ garbage: true });
    expect(results).toHaveLength(0);
    // In-flight dropped, object error-marked, queue can proceed.
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("error");
    expect(manager.getPendingCount()).toBe(0);
  });

  it("drops generations and status on removal; late results discarded", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    const request = fake.posted[0]!;
    manager.notifyObjectsRemoved(["a"]);
    expect(manager.getGeneration("a")).toBeNull();
    expect(useGeometryComputeStore.getState().entries["a"]).toBeUndefined();
    fake.respond(okResponse(request));
    expect(results).toHaveLength(0);
    expect(manager.getPendingCount()).toBe(0);
  });

  it("routes multi-object jobs independently; deleting one spares the other", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(fake.posted).toHaveLength(1);
    manager.notifyObjectsRemoved(["b"]);
    // Complete A: queued B was dropped, so nothing else posts.
    fake.respond(okResponse(fake.posted[0]!));
    expect(results.map((r) => r.objectId)).toEqual(["a"]);
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(0);
  });

  it("recovers from worker crash: terminates, errors in-flight, fresh worker on next edit", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    fake.fail(new Error("boom"));
    expect(fake.terminated).toBe(true);
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("error");
    expect(manager.getPendingCount()).toBe(0);
    expect(results).toHaveLength(0);
    // Next edit lazily creates a fresh worker and computes again.
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    expect(createTransportCalls).toBe(2);
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("pending");
  });

  it("marks error status on accepted error results and empty clears", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    const request = fake.posted[0]!;
    fake.respond({ ...okResponse(request), result: { status: "error", error: "bad math" } });
    expect(results).toHaveLength(1);
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("error");

    manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    // Complete the errored A first is impossible (single in-flight); respond
    // to B only after A... actually A already resolved. Respond to B:
    const bRequest = fake.posted[1]!;
    fake.respond({ ...okResponse(bRequest), result: { status: "empty" } });
    expect(results).toHaveLength(2);
    expect(useGeometryComputeStore.getState().entries["b"]).toBeUndefined();
  });

  it("marks budget results as errors with guidance", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    fake.respond({ ...okResponse(fake.posted[0]!), result: { status: "budget-exceeded" } });
    expect(results).toHaveLength(1);
    const entry = useGeometryComputeStore.getState().entries["a"];
    expect(entry?.status).toBe("error");
    expect(entry?.message).toMatch(/resolution/i);
  });

  it("dispose terminates, clears state, and rejects further requests", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    manager.dispose();
    expect(fake.terminated).toBe(true);
    expect(useGeometryComputeStore.getState().entries).toEqual({});
    expect(manager.getPendingCount()).toBe(0);
    expect(manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" })).toBeNull();
    expect(createTransportCalls).toBe(1);
  });

  it("reports transport construction failure as an error without throwing", () => {
    const failing = createGeometryComputeManager({
      createTransport: () => {
        throw new Error("no workers here");
      },
      onResult: (response) => {
        results.push(response);
      }
    });
    const outcome = failing.requestCompute({
      objectId: "a",
      kind: "implicitSurface",
      payload: IMPLICIT_PAYLOAD,
      params: {},
      structure: "dark::s"
    });
    expect(outcome).toBeNull();
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("error");
    failing.dispose();
  });

  it("crash error-marks queued jobs too, never leaving stuck pending (B1)", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    manager.requestCompute({ objectId: "b", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: {}, structure: "dark::s" });
    // A in flight, B queued behind it.
    expect(fake.posted).toHaveLength(1);
    expect(manager.getPendingCount()).toBe(2);
    fake.fail(new Error("boom"));
    expect(fake.terminated).toBe(true);
    expect(useGeometryComputeStore.getState().entries["a"]?.status).toBe("error");
    expect(useGeometryComputeStore.getState().entries["b"]?.status).toBe("error");
    expect(manager.getPendingCount()).toBe(0);
  });

  it("posts structured-clone-safe requests (no functions)", () => {
    manager.requestCompute({ objectId: "a", kind: "implicitSurface", payload: IMPLICIT_PAYLOAD, params: { r: 2 }, structure: "dark::s" });
    const cloned = structuredClone(fake.posted[0]);
    expect(cloned).toEqual(fake.posted[0]);
  });

  it("vector race: radial, rotation, nonlinear out of order — only newest applies (S20 PART 20)", () => {
    // S20-R11: production vector jobs are 3D (2D fields never touch the
    // worker); the race exercises the 3D payload shape.
    const fieldPayload = (pExpr: string, qExpr: string, rExpr: string) => ({
      dimension: "3d" as const,
      pExpr,
      qExpr,
      rExpr,
      domain: { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -3, zMax: 3 },
      density: 8
    });
    const fieldOk = (request: GeometryComputeRequest): GeometryComputeResponse => ({
      requestId: request.requestId,
      objectId: request.objectId,
      generation: request.generation,
      kind: "vectorField",
      structure: request.structure,
      result: {
        status: "ok",
        positions: new Float32Array([0, 0, 0]),
        vectors: new Float32Array([1, 0, 0]),
        magnitudes: new Float32Array([1]),
        validCount: 1,
        totalSamples: 1,
        maxMagnitude: 1
      }
    });

    // Rapid radial -> rotation -> nonlinear edits on one object.
    manager.requestCompute({ objectId: "vf", kind: "vectorField", payload: fieldPayload("x", "y", "z"), params: {}, structure: "dark::s1" });
    manager.requestCompute({ objectId: "vf", kind: "vectorField", payload: fieldPayload("-y", "x", "0"), params: {}, structure: "dark::s2" });
    manager.requestCompute({
      objectId: "vf",
      kind: "vectorField",
      payload: fieldPayload("sin(y)", "sin(z)", "sin(x)"),
      params: {},
      structure: "dark::s3"
    });
    // First posted immediately; second coalesced away, third queued.
    expect(fake.posted).toHaveLength(1);
    expect(fake.posted[0]!.generation).toBe(1);
    expect(manager.getPendingCount()).toBe(2);

    // Stale gen-1 (radial) response arrives: discarded, worker freed for gen-3.
    fake.respond(fieldOk(fake.posted[0]!));
    expect(results).toHaveLength(0);
    expect(fake.posted).toHaveLength(2);
    expect(fake.posted[1]!.generation).toBe(3);
    expect(fake.posted[1]!.structure).toBe("dark::s3");

    // Newest (nonlinear) completes and applies exactly once.
    fake.respond(fieldOk(fake.posted[1]!));
    expect(results).toHaveLength(1);
    expect(results[0]!.structure).toBe("dark::s3");
    expect(manager.getPendingCount()).toBe(0);
    expect(useGeometryComputeStore.getState().entries["vf"]).toBeUndefined();
  });
});
