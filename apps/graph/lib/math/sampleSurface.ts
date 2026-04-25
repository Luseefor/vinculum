import type { SurfaceDomain } from "@vinculum/scene/types";
import { normalizeSurfaceResolution } from "@vinculum/scene/defaults";
import type { SurfaceEvaluator } from "./compileExpression";

interface SampleSurfaceOptions {
  domain: SurfaceDomain;
  resolution: number;
  invalidHeight?: number;
  clampHeight?: number;
  orientation?: "x" | "y" | "z";
}

export interface SampledSurfaceMesh {
  positions: Float32Array;
  indices: Uint16Array;
}

const DEFAULT_CLAMP_HEIGHT = 10_000;
const MAX_SURFACE_POSITION_BUFFER_BYTES = 2_000_000;

export function sampleSurface(evaluate: SurfaceEvaluator, options: SampleSurfaceOptions): SampledSurfaceMesh {
  const resolution = normalizeSurfaceResolution(options.resolution);
  const invalidHeight = options.invalidHeight ?? 0;
  const clampHeight = Math.max(1, options.clampHeight ?? DEFAULT_CLAMP_HEIGHT);
  const orientation = options.orientation ?? "z";

  const xMin = Math.min(options.domain.xMin, options.domain.xMax);
  const xMax = Math.max(options.domain.xMin, options.domain.xMax);
  const yMin = Math.min(options.domain.yMin, options.domain.yMax);
  const yMax = Math.max(options.domain.yMin, options.domain.yMax);

  const stride = resolution + 1;
  const vertexCount = stride * stride;
  const estimatedPositionBytes = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedPositionBytes > MAX_SURFACE_POSITION_BUFFER_BYTES) {
    const boundedResolution = Math.max(
      2,
      Math.floor(Math.sqrt(MAX_SURFACE_POSITION_BUFFER_BYTES / (3 * Float32Array.BYTES_PER_ELEMENT))) - 1
    );
    throw new Error(
      `Surface resolution ${resolution} exceeds memory budget. Use ${Math.min(resolution, boundedResolution)} or lower.`
    );
  }
  const positions = new Float32Array(vertexCount * 3);
  const validVertices = new Uint8Array(vertexCount);

  let vertexOffset = 0;
  for (let yStep = 0; yStep <= resolution; yStep += 1) {
    const vValue = lerp(yMin, yMax, yStep / resolution);

    for (let xStep = 0; xStep <= resolution; xStep += 1) {
      const vertexIndex = yStep * stride + xStep;
      const uValue = lerp(xMin, xMax, xStep / resolution);
      const sampledHeight = evaluate(uValue, vValue);

      const isFinite = Number.isFinite(sampledHeight);
      const h = isFinite ? clamp(sampledHeight, -clampHeight, clampHeight) : invalidHeight;

      if (orientation === "x") {
        // x = f(y, z)
        // World mapping used throughout the scene:
        // - world.x = math.x
        // - world.y (up) = math.z
        // - world.z = math.y
        // uValue is math.y, vValue is math.z, h is math.x
        positions[vertexOffset] = h;          // math.x -> world.x
        positions[vertexOffset + 1] = vValue; // math.z -> world.y (up)
        positions[vertexOffset + 2] = uValue; // math.y -> world.z
      } else if (orientation === "y") {
        // y = f(x, z)
        // uValue is math.x, vValue is math.z, h is math.y
        positions[vertexOffset] = uValue;     // math.x -> world.x
        positions[vertexOffset + 1] = vValue; // math.z -> world.y (up)
        positions[vertexOffset + 2] = h;      // math.y -> world.z
      } else {
        // z = f(x, y)
        // uValue is math.x, vValue is math.y, h is math.z
        positions[vertexOffset] = uValue;     // math.x -> world.x
        positions[vertexOffset + 1] = h;      // math.z -> world.y (up)
        positions[vertexOffset + 2] = vValue; // math.y -> world.z
      }

      validVertices[vertexIndex] = isFinite ? 1 : 0;
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
    indices: new Uint16Array(indices)
  };
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
