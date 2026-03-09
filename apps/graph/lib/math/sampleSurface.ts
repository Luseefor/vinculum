import type { SurfaceDomain } from "@vinculum/scene/types";
import type { SurfaceEvaluator } from "./compileExpression";

interface SampleSurfaceOptions {
  domain: SurfaceDomain;
  resolution: number;
  invalidHeight?: number;
  clampHeight?: number;
}

export interface SampledSurfaceMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

const DEFAULT_CLAMP_HEIGHT = 10_000;

export function sampleSurface(evaluate: SurfaceEvaluator, options: SampleSurfaceOptions): SampledSurfaceMesh {
  const resolution = Math.max(2, Math.floor(options.resolution));
  const invalidHeight = options.invalidHeight ?? 0;
  const clampHeight = Math.max(1, options.clampHeight ?? DEFAULT_CLAMP_HEIGHT);

  const xMin = Math.min(options.domain.xMin, options.domain.xMax);
  const xMax = Math.max(options.domain.xMin, options.domain.xMax);
  const yMin = Math.min(options.domain.yMin, options.domain.yMax);
  const yMax = Math.max(options.domain.yMin, options.domain.yMax);

  const stride = resolution + 1;
  const vertexCount = stride * stride;
  const positions = new Float32Array(vertexCount * 3);
  const validVertices = new Uint8Array(vertexCount);

  let vertexOffset = 0;
  for (let yStep = 0; yStep <= resolution; yStep += 1) {
    const yValue = lerp(yMin, yMax, yStep / resolution);

    for (let xStep = 0; xStep <= resolution; xStep += 1) {
      const vertexIndex = yStep * stride + xStep;
      const xValue = lerp(xMin, xMax, xStep / resolution);
      const sampledHeight = evaluate(xValue, yValue);

      if (Number.isFinite(sampledHeight)) {
        positions[vertexOffset] = xValue;
        positions[vertexOffset + 1] = clamp(sampledHeight, -clampHeight, clampHeight);
        positions[vertexOffset + 2] = yValue;
        validVertices[vertexIndex] = 1;
      } else {
        positions[vertexOffset] = xValue;
        positions[vertexOffset + 1] = invalidHeight;
        positions[vertexOffset + 2] = yValue;
        validVertices[vertexIndex] = 0;
      }

      vertexOffset += 3;
    }
  }

  const indices: number[] = [];
  for (let yStep = 0; yStep < resolution; yStep += 1) {
    for (let xStep = 0; xStep < resolution; xStep += 1) {
      const a = yStep * stride + xStep;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;

      if (validVertices[a] && validVertices[c] && validVertices[b]) {
        indices.push(a, c, b);
      }

      if (validVertices[b] && validVertices[c] && validVertices[d]) {
        indices.push(b, c, d);
      }
    }
  }

  return {
    positions,
    indices: new Uint32Array(indices)
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
