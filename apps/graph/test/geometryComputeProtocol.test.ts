import { describe, expect, it } from "vitest";
import {
  isGeometryComputeRequest,
  isGeometryComputeResponse
} from "@/lib/compute/geometryComputeProtocol";
import { getParamScopeSignature } from "@/lib/math/paramScope";
import type {
  GeometryComputeRequest,
  GeometryComputeResponse
} from "@/lib/compute/geometryComputeProtocol";

function makeImplicitRequest(overrides: Partial<GeometryComputeRequest> = {}): GeometryComputeRequest {
  return {
    requestId: 1,
    objectId: "obj-1",
    generation: 1,
    kind: "implicitSurface",
    params: { r: 2.5 },
    structure: "dark::structure-1",
    payload: {
      equation: "x^2 + y^2 + z^2 = 1",
      domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
      resolution: 16
    },
    ...overrides
  } as GeometryComputeRequest;
}

function makeOkResponse(overrides: Partial<GeometryComputeResponse> = {}): GeometryComputeResponse {
  return {
    requestId: 1,
    objectId: "obj-1",
    generation: 1,
    kind: "implicitSurface",
    structure: "dark::structure-1",
    result: {
      status: "ok",
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
      rejectedTriangles: 0
    },
    ...overrides
  };
}

describe("getParamScopeSignature", () => {
  it("is sorted and deterministic", () => {
    expect(getParamScopeSignature({ b: 2, a: 1 })).toBe("a:1|b:2");
    expect(getParamScopeSignature({})).toBe("");
    expect(getParamScopeSignature({ r: 2.5 })).toBe("r:2.5");
  });
});

describe("isGeometryComputeRequest", () => {
  it("accepts a valid implicit request", () => {
    expect(isGeometryComputeRequest(makeImplicitRequest())).toBe(true);
  });

  it("accepts a valid parametric request", () => {
    expect(
      isGeometryComputeRequest({
        requestId: 2,
        objectId: "obj-2",
        generation: 1,
        kind: "parametricSurface",
        params: {},
        structure: "dark::structure-2",
        payload: {
          xExpr: "u",
          yExpr: "v",
          zExpr: "0",
          domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
          resolution: 24,
          clampCoordinate: 10_000
        }
      })
    ).toBe(true);
  });

  it("rejects unknown kinds and malformed identities", () => {
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), kind: "surface" })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), requestId: -1 })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), requestId: 1.5 })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), objectId: "" })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), generation: -2 })).toBe(false);
    expect(isGeometryComputeRequest(null)).toBe(false);
    expect(isGeometryComputeRequest("request")).toBe(false);
    expect(isGeometryComputeRequest([])).toBe(false);
  });

  it("rejects non-finite params and malformed payloads", () => {
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), params: { r: Number.NaN } })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), params: { r: "2.5" } })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), payload: null })).toBe(false);
    expect(isGeometryComputeRequest({ ...makeImplicitRequest(), structure: "" })).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...makeImplicitRequest(),
        kind: "parametricSurface",
        payload: { equation: "x" }
      })
    ).toBe(false);
  });

  it("rejects non-finite resolution, domain fields, and clamp values", () => {
    const base = makeImplicitRequest();
    const payload = base.payload;
    if (payload && "equation" in payload) {
      expect(
        isGeometryComputeRequest({
          ...base,
          payload: { ...payload, resolution: Number.NaN }
        })
      ).toBe(false);
      expect(
        isGeometryComputeRequest({
          ...base,
          payload: { ...payload, domain: { ...payload.domain, xMax: Number.POSITIVE_INFINITY } }
        })
      ).toBe(false);
    }
    expect(
      isGeometryComputeRequest({
        requestId: 2,
        objectId: "obj-2",
        generation: 1,
        kind: "parametricSurface",
        params: {},
        structure: "dark::s",
        payload: {
          xExpr: "u",
          yExpr: "v",
          zExpr: "0",
          domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 },
          resolution: 24,
          clampCoordinate: Number.NaN
        }
      })
    ).toBe(false);
  });
});

describe("isGeometryComputeResponse", () => {
  it("accepts ok/empty/budget-exceeded/error responses", () => {
    expect(isGeometryComputeResponse(makeOkResponse())).toBe(true);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: { status: "empty" } })).toBe(true);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: { status: "budget-exceeded" } })).toBe(true);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: { status: "error", error: "boom" } })).toBe(
      true
    );
  });

  it("accepts Uint32 indices", () => {
    expect(
      isGeometryComputeResponse({
        ...makeOkResponse(),
        result: {
          status: "ok",
          positions: new Float32Array(6),
          indices: new Uint32Array([0, 1, 2]),
          vertexCount: 2,
          triangleCount: 1,
          rejectedTriangles: 0
        }
      })
    ).toBe(true);
  });

  it("rejects plain-array buffers and malformed responses", () => {
    expect(
      isGeometryComputeResponse({
        ...makeOkResponse(),
        result: { status: "ok", positions: [0, 0, 0], indices: [0, 1, 2] }
      })
    ).toBe(false);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: { status: "error" } })).toBe(false);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: { status: "nope" } })).toBe(false);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), kind: "surface" })).toBe(false);
    expect(isGeometryComputeResponse({ ...makeOkResponse(), result: null })).toBe(false);
    expect(isGeometryComputeResponse(undefined)).toBe(false);
  });

  it("rejects Float64Array buffers, empty buffers, and ragged positions", () => {
    expect(
      isGeometryComputeResponse({
        ...makeOkResponse(),
        result: {
          status: "ok",
          positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint16Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          rejectedTriangles: 0
        }
      })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({
        ...makeOkResponse(),
        result: {
          status: "ok",
          positions: new Float32Array(0),
          indices: new Uint16Array(0),
          vertexCount: 0,
          triangleCount: 0,
          rejectedTriangles: 0
        }
      })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({
        ...makeOkResponse(),
        result: {
          status: "ok",
          positions: new Float32Array([0, 0, 0, 1]),
          indices: new Uint16Array([0, 1, 2]),
          vertexCount: 3,
          triangleCount: 1,
          rejectedTriangles: 0
        }
      })
    ).toBe(false);
  });

  it("requires the echoed structure on responses", () => {
    expect(isGeometryComputeResponse({ ...makeOkResponse(), structure: "" })).toBe(false);
    const withoutStructure = { ...makeOkResponse() } as Record<string, unknown>;
    delete withoutStructure.structure;
    expect(isGeometryComputeResponse(withoutStructure)).toBe(false);
  });
});

describe("vectorField protocol (S20 Slice 3)", () => {
  const vectorPayload2D = {
    dimension: "2d",
    pExpr: "x",
    qExpr: "y",
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    density: 16
  };

  function makeVectorRequest(overrides: Record<string, unknown> = {}) {
    return {
      requestId: 7,
      objectId: "vf-1",
      generation: 1,
      kind: "vectorField",
      params: {},
      structure: "dark::vf",
      payload: { ...vectorPayload2D },
      ...overrides
    };
  }

  function makeVectorResponse(overrides: Record<string, unknown> = {}) {
    return {
      requestId: 7,
      objectId: "vf-1",
      generation: 1,
      kind: "vectorField",
      structure: "dark::vf",
      result: {
        status: "ok",
        positions: new Float32Array([0, 0, 0, 1, 1, 0]),
        vectors: new Float32Array([1, 0, 0, 0, 1, 0]),
        magnitudes: new Float32Array([1, 1]),
        validCount: 2,
        totalSamples: 2,
        maxMagnitude: 1
      },
      ...overrides
    };
  }

  it("accepts valid 2D and 3D vector requests and responses", () => {
    expect(isGeometryComputeRequest(makeVectorRequest())).toBe(true);
    expect(
      isGeometryComputeRequest({
        ...makeVectorRequest(),
        payload: {
          dimension: "3d",
          pExpr: "x",
          qExpr: "y",
          rExpr: "z",
          domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
          density: 8
        }
      })
    ).toBe(true);
    expect(isGeometryComputeResponse(makeVectorResponse())).toBe(true);
  });

  it("rejects malformed vector payloads", () => {
    expect(
      isGeometryComputeRequest({ ...makeVectorRequest(), payload: { ...vectorPayload2D, dimension: "4d" } })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({ ...makeVectorRequest(), payload: { ...vectorPayload2D, density: Number.NaN } })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...makeVectorRequest(),
        payload: { ...vectorPayload2D, domain: { ...vectorPayload2D.domain, xMax: Number.POSITIVE_INFINITY } }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({ ...makeVectorRequest(), payload: { ...vectorPayload2D, pExpr: 42 } })
    ).toBe(false);
    // S20-R4: R on 2D and out-of-range densities fail closed at the gate.
    expect(
      isGeometryComputeRequest({ ...makeVectorRequest(), payload: { ...vectorPayload2D, rExpr: "z" } })
    ).toBe(false);
    for (const density of [0, 1, 33]) {
      expect(
        isGeometryComputeRequest({ ...makeVectorRequest(), payload: { ...vectorPayload2D, density } })
      ).toBe(false);
    }
    expect(
      isGeometryComputeRequest({
        ...makeVectorRequest(),
        payload: {
          dimension: "3d",
          pExpr: "x",
          qExpr: "y",
          rExpr: "z",
          domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1, zMin: -1, zMax: 1 },
          density: 13
        }
      })
    ).toBe(false);
  });

  it("rejects malformed vector ok results", () => {
    // Mismatched vector length.
    expect(
      isGeometryComputeResponse({
        ...makeVectorResponse(),
        result: {
          status: "ok",
          positions: new Float32Array([0, 0, 0, 1, 1, 0]),
          vectors: new Float32Array([1, 0, 0]),
          magnitudes: new Float32Array([1, 1]),
          validCount: 2,
          totalSamples: 2,
          maxMagnitude: 1
        }
      })
    ).toBe(false);
    // Mismatched magnitude length.
    expect(
      isGeometryComputeResponse({
        ...makeVectorResponse(),
        result: {
          status: "ok",
          positions: new Float32Array([0, 0, 0, 1, 1, 0]),
          vectors: new Float32Array([1, 0, 0, 0, 1, 0]),
          magnitudes: new Float32Array([1]),
          validCount: 2,
          totalSamples: 2,
          maxMagnitude: 1
        }
      })
    ).toBe(false);
    // Non-Float32 vectors.
    expect(
      isGeometryComputeResponse({
        ...makeVectorResponse(),
        result: {
          status: "ok",
          positions: new Float32Array([0, 0, 0, 1, 1, 0]),
          vectors: new Float64Array([1, 0, 0, 0, 1, 0]),
          magnitudes: new Float32Array([1, 1]),
          validCount: 2,
          totalSamples: 2,
          maxMagnitude: 1
        }
      })
    ).toBe(false);
    // Empty buffers.
    expect(
      isGeometryComputeResponse({
        ...makeVectorResponse(),
        result: {
          status: "ok",
          positions: new Float32Array(0),
          vectors: new Float32Array(0),
          magnitudes: new Float32Array(0),
          validCount: 0,
          totalSamples: 0,
          maxMagnitude: 0
        }
      })
    ).toBe(false);
    // Ragged positions.
    expect(
      isGeometryComputeResponse({
        ...makeVectorResponse(),
        result: {
          status: "ok",
          positions: new Float32Array([0, 0, 0, 1]),
          vectors: new Float32Array([1, 0, 0, 0]),
          magnitudes: new Float32Array([1]),
          validCount: 1,
          totalSamples: 1,
          maxMagnitude: 1
        }
      })
    ).toBe(false);
  });
});
