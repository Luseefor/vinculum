import { describe, expect, it } from "vitest";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import { computeStreamlineData } from "@/lib/math/computeStreamlineData";
import {
  isGeometryComputeRequest,
  isGeometryComputeResponse,
  type GeometryComputeRequest,
  type StreamlineComputeOkResult
} from "@/lib/compute/geometryComputeProtocol";

function streamlineRequest(): GeometryComputeRequest {
  return {
    requestId: 11,
    objectId: "streamline:field-1",
    generation: 1,
    kind: "streamlines",
    params: {},
    structure: "dark::streamline-structure-1",
    payload: {
      dimension: "2d",
      pExpr: "-y",
      qExpr: "x",
      rExpr: "",
      domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
      seedDensity: 4,
      length: "medium",
      quality: "medium"
    }
  };
}

describe("streamlines protocol guards (S24 PART 10/33)", () => {
  it("accepts a valid streamline request and response", () => {
    expect(isGeometryComputeRequest(streamlineRequest())).toBe(true);
    const handled = handleGeometryComputeMessage(streamlineRequest());
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
  });

  it("rejects malformed streamline payloads", () => {
    const base = streamlineRequest();
    if (base.kind !== "streamlines") {
      throw new Error("expected streamlines kind");
    }
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, dimension: "4d" }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, rExpr: "z" }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, length: "endless" }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, quality: "ultra" }
      })
    ).toBe(false);
    expect(
      isGeometryComputeRequest({
        ...base,
        payload: { ...base.payload, seedDensity: Number.NaN }
      })
    ).toBe(false);
    expect(isGeometryComputeRequest({ ...base, kind: "streamline" })).toBe(false);
  });

  it("rejects corrupt streamline results", () => {
    const handled = handleGeometryComputeMessage(streamlineRequest());
    const response = handled?.response;
    expect(response?.result.status).toBe("ok");
    const ok = response?.result as StreamlineComputeOkResult | undefined;
    if (!response || !ok || ok.status !== "ok") {
      throw new Error("expected ok streamline result");
    }
    // Truncated offsets.
    expect(
      isGeometryComputeResponse({
        ...response,
        result: { ...ok, offsets: new Uint32Array([0, 5]) }
      })
    ).toBe(false);
    // Non-monotonic offsets.
    expect(
      isGeometryComputeResponse({
        ...response,
        result: { ...ok, offsets: new Uint32Array([0, 0, ok.totalPoints]) }
      })
    ).toBe(false);
    // Non-finite coordinate.
    const corrupt = new Float32Array(ok.points);
    corrupt[0] = Number.NaN;
    expect(
      isGeometryComputeResponse({ ...response, result: { ...ok, points: corrupt } })
    ).toBe(false);
    // Bad closed flag.
    const closed = new Uint8Array(ok.closed);
    closed[0] = 2;
    expect(
      isGeometryComputeResponse({ ...response, result: { ...ok, closed } })
    ).toBe(false);
  });
});

describe("streamlines worker parity (S24)", () => {
  it("matches the sync core exactly", () => {
    const request = streamlineRequest();
    if (request.kind !== "streamlines") {
      throw new Error("expected streamlines kind");
    }
    const handled = handleGeometryComputeMessage(request);
    expect(handled).not.toBeNull();
    const sync = computeStreamlineData({
      dimension: request.payload.dimension,
      pExpr: request.payload.pExpr,
      qExpr: request.payload.qExpr,
      rExpr: request.payload.rExpr,
      domain: request.payload.domain,
      seedDensity: request.payload.seedDensity,
      length: request.payload.length,
      quality: request.payload.quality,
      params: request.params
    });
    expect(sync.status).toBe("ok");
    const result = handled?.response.result as StreamlineComputeOkResult;
    expect(result.status).toBe("ok");
    if (sync.status !== "ok" || result.status !== "ok") {
      return;
    }
    expect(Array.from(result.points)).toEqual(Array.from(sync.points));
    expect(Array.from(result.offsets)).toEqual(Array.from(sync.offsets));
    expect(Array.from(result.closed)).toEqual(Array.from(sync.closed));
    expect(result.streamlineCount).toBe(sync.streamlineCount);
    expect(result.totalPoints).toBe(sync.totalPoints);
  });

  it("transfers points, offsets, and closed buffers", () => {
    const handled = handleGeometryComputeMessage(streamlineRequest());
    expect(handled).not.toBeNull();
    expect(handled?.transfer).toHaveLength(3);
  });

  it("traces 3D fields through the worker", () => {
    const request = streamlineRequest();
    if (request.kind !== "streamlines") {
      throw new Error("expected streamlines kind");
    }
    const three = {
      ...request,
      payload: {
        ...request.payload,
        dimension: "3d" as const,
        pExpr: "-y",
        qExpr: "x",
        rExpr: "0",
        domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -2, zMax: 2 },
        seedDensity: 2
      }
    };
    const handled = handleGeometryComputeMessage(three);
    expect(handled).not.toBeNull();
    expect(isGeometryComputeResponse(handled?.response)).toBe(true);
    const result = handled?.response.result as StreamlineComputeOkResult;
    expect(result.status).toBe("ok");
    if (result.status !== "ok") {
      return;
    }
    expect(result.dimension).toBe("3d");
    expect(result.points.length).toBe(result.totalPoints * 3);
  });

  it("returns null for unknown messages and errors for unsafe fields", () => {
    expect(handleGeometryComputeMessage({ nope: true })).toBeNull();
    const bad = streamlineRequest();
    if (bad.kind !== "streamlines") {
      throw new Error("expected streamlines kind");
    }
    const handled = handleGeometryComputeMessage({
      ...bad,
      payload: { ...bad.payload, pExpr: "sin(factorial(x))" }
    });
    expect(handled?.response.result.status).toBe("error");
  });
});
