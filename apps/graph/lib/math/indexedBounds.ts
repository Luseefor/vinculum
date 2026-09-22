// Renderer-independent indexed bounding-sphere data for sampled surfaces.
//
// S8 (F7): the fixed sampler grid retains finite placeholders for non-finite
// samples, so Three.js full-buffer bounds can be distorted by unreferenced
// vertices. This helper derives center/radius from INDEX-REFERENCED vertices
// only, mirroring Three.js bounding-sphere semantics (box midpoint center,
// max-distance radius) over the rendered subset. No Three.js imports.

export interface IndexedBoundingSphereData {
  centerX: number;
  centerY: number;
  centerZ: number;
  radius: number;
}

export function computeIndexedBoundingSphereData(
  positions: Float32Array,
  indices: Uint16Array
): IndexedBoundingSphereData | null {
  if (indices.length === 0) {
    return null;
  }

  // Pass 1: min/max over referenced vertices. Repeated indices are processed
  // repeatedly on purpose: cheaper than allocating a referenced mask.
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < indices.length; i += 1) {
    const base = (indices[i] ?? -1) * 3;
    const x = positions[base] ?? 0;
    const y = positions[base + 1] ?? 0;
    const z = positions[base + 2] ?? 0;
    if (x < minX) {
      minX = x;
    }
    if (y < minY) {
      minY = y;
    }
    if (z < minZ) {
      minZ = z;
    }
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
    if (z > maxZ) {
      maxZ = z;
    }
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Pass 2: maximum squared distance from the center to referenced vertices.
  let maxDistanceSquared = 0;
  for (let i = 0; i < indices.length; i += 1) {
    const base = (indices[i] ?? -1) * 3;
    const dx = (positions[base] ?? 0) - centerX;
    const dy = (positions[base + 1] ?? 0) - centerY;
    const dz = (positions[base + 2] ?? 0) - centerZ;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > maxDistanceSquared) {
      maxDistanceSquared = distanceSquared;
    }
  }

  return { centerX, centerY, centerZ, radius: Math.sqrt(maxDistanceSquared) };
}
