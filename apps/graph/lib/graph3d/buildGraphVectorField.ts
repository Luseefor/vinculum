import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D
} from "three";
import { mathToWorld3D, mathVectorToWorld3D } from "@/lib/math/coordinates";
import { computeGlyphLength } from "@/lib/math/vectorFieldGlyphs";

// S20 instanced vector-field glyphs. One field owns exactly one Group with
// two InstancedMeshes (shaft cylinder + head cone) sharing one material —
// O(1) Three resources regardless of glyph count; glyph count alters
// instance counts only. No geometry/material per arrow.
//
// Accepted sample data is MATH-frame (positions, vectors, magnitudes from
// the worker/sampler); this builder applies the canonical math -> world
// axis permutation to positions AND directions (S20 pins (1,2,3)/(4,5,6)
// -> (1,3,2)/(4,6,5)).
//
// Raycast is disabled on both meshes: 1,728 instances must never block
// surface probing, and per-instance selection is out of scope (the field
// stays one object, selectable via the object list).
//
// Sample buffers are retained on group.userData so scale/normalize toggles
// recompute instance matrices on the main thread with zero worker jobs
// (PART 24). Geometries are per-node (never shared module state): shared
// geometry would be disposed out from under sibling fields by
// disposeObject3D.

export interface VectorFieldSampleData {
  positions: Float32Array;
  vectors: Float32Array;
  magnitudes: Float32Array;
  validCount: number;
  maxMagnitude: number;
  cell: number;
}

export interface BuildVectorFieldGroupOptions {
  id: string;
  color: string;
  scale: number;
  normalize: boolean;
  samples: VectorFieldSampleData;
  roughness: number;
  metalness: number;
}

export interface VectorFieldRenderState {
  scale: number;
  normalize: boolean;
}

const GLYPH_SHAFT_FRACTION = 0.7;
const GLYPH_HEAD_FRACTION = 0.3;
const GLYPH_SHAFT_RADIUS_CELLS = 0.04;
const GLYPH_HEAD_RADIUS_CELLS = 0.11;
const CANONICAL_GLYPH_AXIS = new Vector3(0, 1, 0);

const scratchPosition = new Vector3();
const scratchDirection = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();
const scratchMatrix = new Matrix4();
const scratchHeadBase = new Vector3();

export function buildVectorFieldGroup(options: BuildVectorFieldGroupOptions): Group {
  const group = new Group();
  group.userData.vinculumId = options.id;
  // Retained for render-only updates (PART 24). Small and bounded: worst
  // case 1728 samples x 7 floats x 4 bytes (~48KB) per field.
  group.userData.vectorFieldSamples = options.samples;
  group.userData.vectorFieldRender = {
    scale: options.scale,
    normalize: options.normalize
  } satisfies VectorFieldRenderState;

  const material = new MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness,
    metalness: options.metalness
  });

  // Unit glyph parts along +Y, bases at the origin: per-instance matrices
  // carry all placement/sizing.
  const shaftGeometry = new CylinderGeometry(1, 1, 1, 10, 1, false);
  shaftGeometry.translate(0, 0.5, 0);
  const headGeometry = new ConeGeometry(1, 1, 12);
  headGeometry.translate(0, 0.5, 0);

  const capacity = Math.max(options.samples.validCount, 0);
  const shaft = new InstancedMesh(shaftGeometry, material, Math.max(capacity, 1));
  const head = new InstancedMesh(headGeometry, material, Math.max(capacity, 1));
  for (const mesh of [shaft, head]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // Glyphs never participate in picking (see module doc).
    mesh.raycast = () => {};
    group.add(mesh);
  }

  writeVectorFieldInstances(group, options.scale, options.normalize);
  return group;
}

// Recomputes instance matrices from the retained sample cache. Returns the
// live instance count, or -1 when the node carries no field cache (caller
// falls back to resampling; unreachable for builder-produced nodes).
export function writeVectorFieldInstances(group: Group, scale: number, normalize: boolean): number {
  const samples = group.userData.vectorFieldSamples as VectorFieldSampleData | undefined;
  if (!samples) {
    return -1;
  }
  const shaft = group.children[0] as InstancedMesh | undefined;
  const head = group.children[1] as InstancedMesh | undefined;
  if (!shaft || !head || !(shaft instanceof InstancedMesh) || !(head instanceof InstancedMesh)) {
    return -1;
  }

  const { positions, vectors, magnitudes, validCount, maxMagnitude, cell } = samples;
  const shaftRadius = GLYPH_SHAFT_RADIUS_CELLS * cell;
  const headRadius = GLYPH_HEAD_RADIUS_CELLS * cell;
  let count = 0;

  for (let i = 0; i < validCount; i += 1) {
    const magnitude = magnitudes[i] as number;
    const length = computeGlyphLength(magnitude, maxMagnitude, cell, scale, normalize);
    if (!(length > 0)) {
      continue;
    }
    const worldPosition = mathToWorld3D({
      x: positions[i * 3] as number,
      y: positions[i * 3 + 1] as number,
      z: positions[i * 3 + 2] as number
    });
    const worldDirection = mathVectorToWorld3D({
      x: vectors[i * 3] as number,
      y: vectors[i * 3 + 1] as number,
      z: vectors[i * 3 + 2] as number
    });
    const directionLength = Math.sqrt(
      worldDirection.x * worldDirection.x +
        worldDirection.y * worldDirection.y +
        worldDirection.z * worldDirection.z
    );
    if (!(directionLength > 0) || !Number.isFinite(directionLength)) {
      continue;
    }
    scratchDirection.set(
      worldDirection.x / directionLength,
      worldDirection.y / directionLength,
      worldDirection.z / directionLength
    );
    scratchQuaternion.setFromUnitVectors(CANONICAL_GLYPH_AXIS, scratchDirection);
    if (!Number.isFinite(scratchQuaternion.x + scratchQuaternion.y + scratchQuaternion.z + scratchQuaternion.w)) {
      continue;
    }
    scratchPosition.set(worldPosition.x, worldPosition.y, worldPosition.z);

    const shaftLength = GLYPH_SHAFT_FRACTION * length;
    const headLength = GLYPH_HEAD_FRACTION * length;
    scratchScale.set(shaftRadius, shaftLength, shaftRadius);
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    shaft.setMatrixAt(count, scratchMatrix);

    scratchHeadBase
      .copy(scratchDirection)
      .multiplyScalar(shaftLength)
      .add(scratchPosition);
    // length > 0 implies cell > 0 (see computeGlyphLength), so both radii
    // are strictly positive here — never a degenerate cone scale.
    scratchScale.set(headRadius, headLength, headRadius);
    scratchMatrix.compose(scratchHeadBase, scratchQuaternion, scratchScale);
    head.setMatrixAt(count, scratchMatrix);
    count += 1;
  }

  shaft.count = count;
  head.count = count;
  shaft.instanceMatrix.needsUpdate = true;
  head.instanceMatrix.needsUpdate = true;
  // Bounds follow the live instances (not the unit base geometries), so
  // default frustum culling keeps edge-of-domain arrows visible without a
  // frustumCulled=false escape hatch.
  shaft.computeBoundingSphere();
  head.computeBoundingSphere();
  group.userData.vectorFieldRender = { scale, normalize } satisfies VectorFieldRenderState;
  return count;
}

export function getVectorFieldInstanceCount(group: Group): number {
  const shaft = group.children[0];
  return shaft instanceof InstancedMesh ? shaft.count : 0;
}

export function getVectorFieldNode(node: Object3D | undefined): Group | null {
  if (!(node instanceof Group) || !node.userData.vectorFieldSamples) {
    return null;
  }
  return node;
}
