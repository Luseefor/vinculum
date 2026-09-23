import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { computeParametricSurfaceData } from "@/lib/math/computeParametricSurfaceData";
import {
  isGeometryComputeRequest,
  type GeometryComputeRequest,
  type GeometryComputeResponse,
  type GeometryComputeResult
} from "@/lib/compute/geometryComputeProtocol";

// Geometry compute worker entry (S19). Runs pure numerical computation off
// the main thread: compile → sample → extract, returning transferable
// buffers. It never touches Three.js, Zustand, the DOM, persistence, or the
// monitoring transport (unexpected throws are captured as error responses).
// The same pure functions run synchronously in unit tests, so worker/sync
// parity is structural, not coincidental.
//
// Only structured-clone-safe data crosses the boundary (plain inputs in,
// TypedArrays out). Scalar-field grids are temporary worker state and are
// never posted back.

interface GeometryWorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown, transfer?: readonly Transferable[]) => void;
}

// `self` exists only in a real worker context. The message handler above is
// pure and imported directly by unit tests (node/jsdom have no `self`), so
// the scope binding must stay lazy.
const workerScope: GeometryWorkerScope | null =
  typeof self !== "undefined" ? (self as unknown as GeometryWorkerScope) : null;

export interface HandledComputeMessage {
  response: GeometryComputeResponse;
  transfer: Transferable[];
}

// Pure message handler, exported for unit tests: unknown requests return
// null (ignored, never answered); compute throws become error responses.
// Transfer lists the result buffers so postMessage moves (not copies) them;
// the worker never touches a buffer after handing it over.
export function handleGeometryComputeMessage(data: unknown): HandledComputeMessage | null {
  if (!isGeometryComputeRequest(data)) {
    return null;
  }
  const request = data;
  try {
    const result = computeRequestResult(request);
    return {
      response: {
        requestId: request.requestId,
        objectId: request.objectId,
        generation: request.generation,
        kind: request.kind,
        structure: request.structure,
        result
      },
      transfer: collectTransferBuffers(result)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geometry computation failed.";
    const result: GeometryComputeResult = { status: "error", error: message };
    return {
      response: {
        requestId: request.requestId,
        objectId: request.objectId,
        generation: request.generation,
        kind: request.kind,
        structure: request.structure,
        result
      },
      transfer: []
    };
  }
}

function computeRequestResult(request: GeometryComputeRequest): GeometryComputeResult {
  if (request.kind === "implicitSurface") {
    const computed = computeImplicitSurfaceData({
      equation: request.payload.equation,
      domain: request.payload.domain,
      resolution: request.payload.resolution,
      params: request.params
    });
    if (computed.status !== "ok") {
      return computed;
    }
    return {
      status: "ok",
      positions: computed.positions,
      indices: computed.indices,
      vertexCount: computed.vertexCount,
      triangleCount: computed.triangleCount,
      rejectedTriangles: 0
    };
  }
  const computed = computeParametricSurfaceData({
    xExpr: request.payload.xExpr,
    yExpr: request.payload.yExpr,
    zExpr: request.payload.zExpr,
    domain: request.payload.domain,
    resolution: request.payload.resolution,
    clampCoordinate: request.payload.clampCoordinate,
    params: request.params
  });
  if (computed.status !== "ok") {
    return computed;
  }
  return {
    status: "ok",
    positions: computed.positions,
    indices: computed.indices,
    vertexCount: computed.positions.length / 3,
    triangleCount: computed.indices.length / 3,
    rejectedTriangles: computed.rejectedTriangles
  };
}

function collectTransferBuffers(
  result: HandledComputeMessage["response"]["result"]
): Transferable[] {
  if (result.status !== "ok") {
    return [];
  }
  // Freshly allocated result buffers (never SharedArrayBuffers): safe to
  // transfer. The worker drops all references by returning here.
  return [result.positions.buffer as Transferable, result.indices.buffer as Transferable];
}

if (workerScope) {
  const scope: GeometryWorkerScope = workerScope;
  scope.onmessage = (event: MessageEvent) => {
    const handled = handleGeometryComputeMessage(event.data);
    if (!handled) {
      return;
    }
    scope.postMessage(handled.response, handled.transfer);
  };
}
