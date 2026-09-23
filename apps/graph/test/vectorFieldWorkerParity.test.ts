import { describe, expect, it } from "vitest";
import { handleGeometryComputeMessage } from "@/workers/geometryComputeWorker";
import { computeVectorFieldData } from "@/lib/math/computeVectorFieldData";
import type {
  GeometryComputeRequest,
  VectorFieldComputeOkResult
} from "@/lib/compute/geometryComputeProtocol";

interface FieldCase {
  name: string;
  dimension: "2d" | "3d";
  pExpr: string;
  qExpr: string;
  rExpr: string;
  domain:
    | { xMin: number; xMax: number; yMin: number; yMax: number }
    | { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };
  density: number;
  params: Record<string, number>;
}

const CASES: FieldCase[] = [
  {
    name: "2D radial",
    dimension: "2d",
    pExpr: "x",
    qExpr: "y",
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    density: 10,
    params: {}
  },
  {
    name: "2D singular",
    dimension: "2d",
    pExpr: "1/x",
    qExpr: "y",
    rExpr: "",
    domain: { xMin: -2, xMax: 2, yMin: -1, yMax: 1 },
    density: 5,
    params: {}
  },
  {
    name: "3D radial",
    dimension: "3d",
    pExpr: "x",
    qExpr: "y",
    rExpr: "z",
    domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
    density: 5,
    params: {}
  },
  {
    name: "3D nonlinear",
    dimension: "3d",
    pExpr: "sin(y)",
    qExpr: "sin(z)",
    rExpr: "sin(x)",
    domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
    density: 5,
    params: {}
  },
  {
    name: "parameterized field",
    dimension: "3d",
    pExpr: "a*x",
    qExpr: "y",
    rExpr: "z",
    domain: { xMin: -4, xMax: 4, yMin: -4, yMax: 4, zMin: -4, zMax: 4 },
    density: 5,
    params: { a: 2 }
  },
  {
    name: "compile error",
    dimension: "2d",
    pExpr: "zzz",
    qExpr: "y",
    rExpr: "",
    domain: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
    density: 4,
    params: {}
  },
  {
    name: "all-invalid empty",
    dimension: "2d",
    pExpr: "log(x)",
    qExpr: "log(y)",
    rExpr: "",
    domain: { xMin: -2, xMax: -1, yMin: -2, yMax: -1 },
    density: 3,
    params: {}
  }
];

function toRequest(testCase: FieldCase, requestId: number): GeometryComputeRequest {
  return {
    requestId,
    objectId: "vf-parity",
    generation: 1,
    kind: "vectorField",
    params: { ...testCase.params },
    structure: "dark::vf-parity",
    payload: {
      dimension: testCase.dimension,
      pExpr: testCase.pExpr,
      qExpr: testCase.qExpr,
      rExpr: testCase.rExpr,
      domain: { ...testCase.domain },
      density: testCase.density
    }
  };
}

describe("vector field worker/sync parity (S20 PART 19)", () => {
  for (const testCase of CASES) {
    it(`${testCase.name}: worker output equals sync sampler exactly`, () => {
      const sync = computeVectorFieldData({
        dimension: testCase.dimension,
        pExpr: testCase.pExpr,
        qExpr: testCase.qExpr,
        rExpr: testCase.rExpr,
        domain: { ...testCase.domain },
        density: testCase.density,
        params: { ...testCase.params }
      });
      const handled = handleGeometryComputeMessage(toRequest(testCase, 1));
      expect(handled?.response.kind).toBe("vectorField");
      expect(handled?.response.structure).toBe("dark::vf-parity");
      if (sync.status === "ok") {
        expect(handled?.response.result.status).toBe("ok");
        const result = handled?.response.result as VectorFieldComputeOkResult | undefined;
        expect(result).toBeDefined();
        expect(result?.status).toBe("ok");
        if (result?.status === "ok") {
          expect(Array.from(result.positions)).toEqual(Array.from(sync.positions));
          expect(Array.from(result.vectors)).toEqual(Array.from(sync.vectors));
          expect(Array.from(result.magnitudes)).toEqual(Array.from(sync.magnitudes));
          expect(result.validCount).toBe(sync.validCount);
          expect(result.totalSamples).toBe(sync.totalSamples);
          expect(result.maxMagnitude).toBe(sync.maxMagnitude);
        }
      } else {
        // Error/empty parity: same terminal status through the worker.
        expect(handled?.response.result.status).toBe(sync.status);
      }
      // Transfer matches the terminal status.
      expect(handled?.transfer).toHaveLength(sync.status === "ok" ? 3 : 0);
    });
  }
});
