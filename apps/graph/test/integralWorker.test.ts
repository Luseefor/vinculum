import { describe, expect, it } from "vitest";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import { computeIntegralData } from "@/lib/math/computeIntegralData";
import {
  isGeometryComputeRequest,
  isGeometryComputeResponse,
  type GeometryComputeRequest,
  type IntegralAnalysisOkResult
} from "@/lib/compute/geometryComputeProtocol";

function circleArcRequest(): GeometryComputeRequest {
  return {
    requestId: 21,
    objectId: "integral:curve-1",
    generation: 1,
    kind: "integralAnalysis",
    params: {},
    structure: "dark::integral-structure-1",
    payload: {
      mode: "arcLength",
      target: { kind: "parametricCurve", xExpr: "cos(t)", yExpr: "sin(t)", zExpr: "0", tMin: 0, tMax: 2 * Math.PI },
      scalarIntegrand: "",
      field: null,
      quality: "medium",
      direction: 1,
      orientationSign: 1
    }
  };
}

describe("integralAnalysis protocol guards (S25 PART 66)", () => {
  it("accepts a valid integral request and response", () => {
    expect(isGeometryComputeRequest(circleArcRequest())).toBe(true);
    const handled = handleGeometryComputeMessage(circleArcRequest());
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
    expect(handled?.transfer).toEqual([]);
  });

  it("rejects malformed modes, qualities, domains, and enums", () => {
    const base = circleArcRequest();
    if (base.kind !== "integralAnalysis") {
      throw new Error("expected integral kind");
    }
    expect(isGeometryComputeRequest({ ...base, payload: { ...base.payload, mode: "volume" } })).toBe(false);
    expect(isGeometryComputeRequest({ ...base, payload: { ...base.payload, quality: "ultra" } })).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: {
          ...base.payload,
          target: { kind: "parametricCurve", xExpr: "t", yExpr: "0", zExpr: "0", tMin: Number.NaN, tMax: 1 }
        }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: {
          ...base.payload,
          target: { kind: "surface", equation: "z=0", orientation: "w", domain: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 } }
        }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({ ...base, payload: { ...base.payload, direction: 0 } })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({ ...base, payload: { ...base.payload, field: { dimension: "4d", pExpr: "x", qExpr: "y", rExpr: "z" } } })
    ).toBe(false);
    expect(isGeometryComputeRequest({ ...base, kind: "integral" })).toBe(false);
  });

  it("rejects corrupt integral results", () => {
    const handled = handleGeometryComputeMessage(circleArcRequest());
    const response = handled?.response;
    expect(response?.result.status).toBe("ok");
    if (!response || response.result.status !== "ok") {
      throw new Error("expected ok integral result");
    }
    expect(
      isGeometryComputeResponse({ ...response, result: { ...response.result, value: Number.NaN } })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({ ...response, result: { ...response.result, convergenceWarning: "yes" } })
    ).toBe(false);
    expect(
      isGeometryComputeResponse({ ...response, result: { status: "invalid" } })
    ).toBe(true);
    expect(
      isGeometryComputeResponse({ ...response, result: { status: "unsupported", reason: "no derivatives" } })
    ).toBe(true);
    expect(
      isGeometryComputeResponse({ ...response, result: { status: "weird" } })
    ).toBe(false);
  });
});

describe("integralAnalysis worker parity (S25 PART 68)", () => {
  it("matches the sync core on circle arc length", () => {
    const request = circleArcRequest();
    if (request.kind !== "integralAnalysis") {
      throw new Error("expected integral kind");
    }
    const handled = handleGeometryComputeMessage(request);
    expect(handled).not.toBeNull();
    const sync = computeIntegralData({
      mode: request.payload.mode,
      target: request.payload.target,
      scalarIntegrand: request.payload.scalarIntegrand,
      field: request.payload.field,
      quality: request.payload.quality,
      direction: request.payload.direction,
      orientationSign: request.payload.orientationSign,
      params: request.params
    });
    expect(sync.status).toBe("ok");
    const result = handled?.response.result as IntegralAnalysisOkResult;
    expect(result.status).toBe("ok");
    if (sync.status !== "ok" || result.status !== "ok") {
      return;
    }
    expect(result.value).toBe(sync.value);
    expect(result.coarseValue).toBe(sync.coarseValue);
    expect(result.estimatedError).toBe(sync.estimatedError);
    expect(result.value).toBeCloseTo(2 * Math.PI, 6);
  });

  it("matches the sync core on circle work, plane flux, and sphere area", () => {
    const base = circleArcRequest();
    if (base.kind !== "integralAnalysis") {
      throw new Error("expected integral kind");
    }
    const cases: GeometryComputeRequest[] = [
      {
        ...base,
        requestId: 22,
        payload: {
          ...base.payload,
          mode: "work",
          field: { dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" },
          quality: "medium",
          direction: 1
        }
      },
      {
        ...base,
        requestId: 23,
        objectId: "integral:plane-1",
        payload: {
          mode: "flux",
          target: {
            kind: "surface",
            equation: "z = 0",
            orientation: "z",
            domain: { xMin: -1, xMax: 1, yMin: -1, yMax: 1 }
          },
          scalarIntegrand: "",
          field: { dimension: "3d", pExpr: "0", qExpr: "0", rExpr: "1" },
          quality: "medium",
          direction: 1,
          orientationSign: 1
        }
      },
      {
        ...base,
        requestId: 24,
        objectId: "integral:sphere-1",
        payload: {
          mode: "surfaceArea",
          target: {
            kind: "parametricSurface",
            xExpr: "sin(u)*cos(v)",
            yExpr: "sin(u)*sin(v)",
            zExpr: "cos(u)",
            domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI }
          },
          scalarIntegrand: "",
          field: null,
          quality: "medium",
          direction: 1,
          orientationSign: 1
        }
      }
    ];
    const expected = [2 * Math.PI, 4, 4 * Math.PI];
    for (let index = 0; index < cases.length; index += 1) {
      const request = cases[index] as GeometryComputeRequest;
      if (request.kind !== "integralAnalysis") {
        throw new Error("expected integral kind");
      }
      const handled = handleGeometryComputeMessage(request);
      const sync = computeIntegralData({
        mode: request.payload.mode,
        target: request.payload.target,
        scalarIntegrand: request.payload.scalarIntegrand,
        field: request.payload.field,
        quality: request.payload.quality,
        direction: request.payload.direction,
        orientationSign: request.payload.orientationSign,
        params: request.params
      });
      expect(sync.status).toBe("ok");
      const result = handled?.response.result as IntegralAnalysisOkResult;
      expect(result.status).toBe("ok");
      if (sync.status !== "ok" || result.status !== "ok") {
        continue;
      }
      expect(result.value).toBe(sync.value);
      expect(result.coarseValue).toBe(sync.coarseValue);
      expect(result.estimatedError).toBe(sync.estimatedError);
      expect(result.value).toBeCloseTo(expected[index] as number, 3);
    }
  });

  it("computes sphere flux through the worker", () => {
    const request = circleArcRequest();
    if (request.kind !== "integralAnalysis") {
      throw new Error("expected integral kind");
    }
    const flux = {
      ...request,
      payload: {
        ...request.payload,
        mode: "flux" as const,
        target: {
          kind: "parametricSurface" as const,
          xExpr: "sin(u)*cos(v)",
          yExpr: "sin(u)*sin(v)",
          zExpr: "cos(u)",
          domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI }
        },
        field: { dimension: "3d" as const, pExpr: "x", qExpr: "y", rExpr: "z" },
        quality: "medium" as const
      }
    };
    const handled = handleGeometryComputeMessage(flux);
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
    const result = handled?.response.result as IntegralAnalysisOkResult;
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.value).toBeCloseTo(4 * Math.PI, 3);
  });

  it("returns null for unknown messages and structured statuses for bad math", () => {
    expect(handleGeometryComputeMessage({ nope: true })).toBeNull();
    const bad = circleArcRequest();
    if (bad.kind !== "integralAnalysis") {
      throw new Error("expected integral kind");
    }
    const singular = handleGeometryComputeMessage({
      ...bad,
      payload: {
        ...bad.payload,
        target: { kind: "parametricCurve", xExpr: "1/t", yExpr: "0", zExpr: "0", tMin: -1, tMax: 1 }
      }
    });
    expect(singular?.response.result.status).toBe("invalid");
    const unsafe = handleGeometryComputeMessage({
      ...bad,
      payload: { ...bad.payload, mode: "scalarLine", scalarIntegrand: "sin(factorial(x))" }
    });
    expect(unsafe?.response.result.status).toBe("invalid");
  });
});
