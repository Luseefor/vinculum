import { computeImplicitSurfaceData } from "@/lib/math/computeImplicitSurfaceData";
import { computeParametricSurfaceData } from "@/lib/math/computeParametricSurfaceData";
import { computeScalarFieldData } from "@/lib/math/computeScalarFieldData";
import { computeVectorFieldData } from "@/lib/math/computeVectorFieldData";
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
  if (request.kind === "scalarField") {
    // S23: same pure core the 2D path and unit tests use (parity is
    // structural). Scalar grids stay worker-local temporaries; only the
    // result buffers below cross back.
    const computed = computeScalarFieldData({
      source: request.payload.source,
      target: request.payload.target,
      resolution: request.payload.resolution,
      contourCount: request.payload.contourCount,
      gradientDensity: request.payload.gradientDensity,
      params: request.params
    });
    if (computed.status !== "ok") {
      return computed;
    }
    return {
      status: "ok",
      values: computed.values,
      valid: computed.valid,
      width: computed.width,
      height: computed.height,
      domain: computed.domain,
      min: computed.min,
      max: computed.max,
      validCount: computed.validCount,
      totalSamples: computed.totalSamples,
      levels: computed.levels,
      contourSegments: computed.contourSegments,
      contourSegmentCount: computed.contourSegmentCount,
      contourStatus: computed.contourStatus,
      gradientPositions: computed.gradientPositions,
      gradientVectors: computed.gradientVectors,
      gradientMagnitudes: computed.gradientMagnitudes,
      gradientValidCount: computed.gradientValidCount,
      gradientMaxMagnitude: computed.gradientMaxMagnitude,
      gradientStatus: computed.gradientStatus
    };
  }
  if (request.kind === "vectorField") {
    // S20: the worker runs the same pure sampler the 2D path and unit
    // tests use (parity is structural). Buffers compact to valid samples.
    const computed = computeVectorFieldData({
      dimension: request.payload.dimension,
      pExpr: request.payload.pExpr,
      qExpr: request.payload.qExpr,
      rExpr: request.payload.rExpr,
      domain: request.payload.domain,
      density: request.payload.density,
      params: request.params
    });
    if (computed.status !== "ok") {
      return computed;
    }
    return {
      status: "ok",
      positions: computed.positions,
      vectors: computed.vectors,
      magnitudes: computed.magnitudes,
      validCount: computed.validCount,
      totalSamples: computed.totalSamples,
      maxMagnitude: computed.maxMagnitude
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
  if ("vectors" in result) {
    return [
      result.positions.buffer as Transferable,
      result.vectors.buffer as Transferable,
      result.magnitudes.buffer as Transferable
    ];
  }
  if ("values" in result) {
    // Scalar buffers move (not copy); the worker drops all references by
    // returning here. Zero-length views transfer harmlessly, so no
    // conditional filtering is needed — but detached re-post is avoided
    // because each buffer is freshly allocated per job.
    return [
      result.values.buffer as Transferable,
      result.valid.buffer as Transferable,
      result.levels.buffer as Transferable,
      result.contourSegments.buffer as Transferable,
      result.gradientPositions.buffer as Transferable,
      result.gradientVectors.buffer as Transferable,
      result.gradientMagnitudes.buffer as Transferable
    ];
  }
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
