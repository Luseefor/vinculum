import { describe, expect, it } from "vitest";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import { computeScalarFieldData } from "@/lib/math/computeScalarFieldData";
import {
  isGeometryComputeRequest,
  isGeometryComputeResponse,
  type GeometryComputeRequest,
  type ScalarFieldComputeOkResult
} from "@/lib/compute/geometryComputeProtocol";

function scalarRequest(): GeometryComputeRequest {
  return {
    requestId: 7,
    objectId: "scalar:obj-1",
    generation: 1,
    kind: "scalarField",
    params: {},
    structure: "dark::scalar-structure-1",
    payload: {
      source: { kind: "surface", equation: "z = x^2 + y^2", orientation: "z" },
      target: { kind: "domain2D", domain: { uMin: -5, uMax: 5, vMin: -5, vMax: 5 } },
      resolution: 32,
      contourCount: 8,
      gradientDensity: 8
    }
  };
}

describe("scalarField protocol guards (S23 PART 8/24)", () => {
  it("accepts a valid scalar request and response", () => {
    expect(isGeometryComputeRequest(scalarRequest())).toBe(true);
    const handled = handleGeometryComputeMessage(scalarRequest());
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
  });

  it("rejects malformed scalar payloads", () => {
    const base = scalarRequest();
    if (base.kind !== "scalarField") {
      throw new Error("expected scalar kind");
    }
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, source: { kind: "surface", equation: "z=x", orientation: "w" } }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: {
          ...base.payload,
          target: { kind: "slice", plane: "xx", planeValue: 0, domain: base.payload.target.domain }
        }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, resolution: Number.NaN }
      })
    ).toBe(false);
    expect(isGeometryComputeRequest({ ...base, kind: "scalarSlice" })).toBe(false);
  });

  it("rejects corrupt scalar results", () => {
    const handled = handleGeometryComputeMessage(scalarRequest());
    const response = handled?.response;
    expect(response).toBeDefined();
    if (!response || response.result.status !== "ok") {
      throw new Error("expected ok scalar result");
    }
    expect(
      isGeometryComputeResponse({
        ...response,
        result: { ...response.result, contourSegmentCount: 999 }
      })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({
        ...response,
        result: { ...response.result, contourStatus: "partial" }
      })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({
        ...response,
        result: { ...response.result, gradientStatus: "computing" }
      })
    ).toBe(false);
  });
});

describe("scalarField worker parity (S23)", () => {
  it("matches the sync core exactly", () => {
    const request = scalarRequest();
    if (request.kind !== "scalarField") {
      throw new Error("expected scalar kind");
    }
    const handled = handleGeometryComputeMessage(request);
    expect(handled).not.toBeNull();
    const sync = computeScalarFieldData({
      source: request.payload.source,
      target: request.payload.target,
      resolution: request.payload.resolution,
      contourCount: request.payload.contourCount,
      gradientDensity: request.payload.gradientDensity,
      params: request.params
    });
    expect(sync.status).toBe("ok");
    const result = handled?.response.result as ScalarFieldComputeOkResult;
    expect(result.status).toBe("ok");
    if (sync.status !== "ok" || result.status !== "ok") {
      return;
    }
    expect(Array.from(result.values)).toEqual(Array.from(sync.values));
    expect(Array.from(result.valid)).toEqual(Array.from(sync.valid));
    expect(Array.from(result.contourSegments)).toEqual(Array.from(sync.contourSegments));
    expect(Array.from(result.gradientVectors)).toEqual(Array.from(sync.gradientVectors));
    expect(result.min).toBe(sync.min);
    expect(result.max).toBe(sync.max);
    expect(result.contourStatus).toBe(sync.contourStatus);
    expect(result.gradientStatus).toBe(sync.gradientStatus);
  });

  it("transfers every result buffer", () => {
    const handled = handleGeometryComputeMessage(scalarRequest());
    expect(handled).not.toBeNull();
    const buffers = handled?.transfer.map((entry) => (entry as ArrayBuffer).byteLength ?? 0) ?? [];
    // values, valid, levels, contourSegments, gradient x3.
    expect(handled?.transfer).toHaveLength(7);
    expect(buffers.every((length) => length >= 0)).toBe(true);
  });

  it("computes slices through the worker", () => {
    const request = scalarRequest();
    if (request.kind !== "scalarField") {
      throw new Error("expected scalar kind");
    }
    const slice = {
      ...request,
      payload: {
        ...request.payload,
        source: { kind: "implicit" as const, equation: "x^2+y^2+z^2-1" },
        target: {
          kind: "slice" as const,
          plane: "xy" as const,
          planeValue: 0,
          domain: { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }
        },
        resolution: 32,
        gradientDensity: 0
      }
    };
    const handled = handleGeometryComputeMessage(slice);
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
    const result = handled?.response.result as ScalarFieldComputeOkResult | undefined;
    expect(result?.status).toBe("ok");
    if (!result || result.status !== "ok") {
      return;
    }
    expect(result.min).toBeCloseTo(-1, 6);
    expect(result.gradientStatus).toBe("skipped");
  });

  it("returns null for unknown messages and errors for bad math", () => {
    expect(handleGeometryComputeMessage({ nope: true })).toBeNull();
    const bad = scalarRequest();
    if (bad.kind !== "scalarField") {
      throw new Error("expected scalar kind");
    }
    const handled = handleGeometryComputeMessage({
      ...bad,
      payload: {
        ...bad.payload,
        source: { kind: "surface", equation: "z = sin(factorial(x))", orientation: "z" }
      }
    });
    expect(handled?.response.result.status).toBe("error");
  });
});
