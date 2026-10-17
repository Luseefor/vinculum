import { describe, expect, it } from "vitest";
import { Group, InstancedMesh, Matrix4, Quaternion, Raycaster, Vector3 } from "three";
import {
  buildVectorFieldGroup,
  getVectorFieldInstanceCount,
  getVectorFieldNode,
  writeVectorFieldInstances,
  type VectorFieldSampleData
} from "@/lib/graph3d/buildGraphVectorField";

function makeSamples(overrides: Partial<VectorFieldSampleData> = {}): VectorFieldSampleData {
  // Math-frame samples: positions (1,2,3)/(0,0,0), vectors (4,5,6)/(0,0,0).
  return {
    positions: new Float32Array([1, 2, 3, 0, 0, 0]),
    vectors: new Float32Array([4, 5, 6, 0, 0, 0]),
    magnitudes: new Float32Array([Math.sqrt(77), 0]),
    validCount: 2,
    maxMagnitude: Math.sqrt(77),
    cell: 0.5,
    ...overrides
  };
}

function shaftLengthOf(group: Group, index: number): number {
  const shaft = group.children[0] as InstancedMesh;
  const matrix = new Matrix4();
  shaft.getMatrixAt(index, matrix);
  const scale = new Vector3();
  matrix.decompose(new Vector3(), new Quaternion(), scale);
  return scale.y / 0.7;
}

function directionOf(group: Group, index: number): Vector3 {
  const shaft = group.children[0] as InstancedMesh;
  const matrix = new Matrix4();
  shaft.getMatrixAt(index, matrix);
  const quaternion = new Quaternion();
  matrix.decompose(new Vector3(), quaternion, new Vector3());
  return new Vector3(0, 1, 0).applyQuaternion(quaternion);
}

describe("buildVectorFieldGroup (S20 Slice 4a)", () => {
  it("maps math point (1,2,3) to world (1,3,2) and direction (4,5,6) to (4,6,5)", () => {
    const group = buildVectorFieldGroup({
      id: "vf-1",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples: makeSamples(),
      roughness: 0.6,
      metalness: 0
    });
    // Two valid samples, one zero-magnitude: exactly one instance.
    expect(getVectorFieldInstanceCount(group)).toBe(1);

    const shaft = group.children[0] as InstancedMesh;
    const matrix = new Matrix4();
    shaft.getMatrixAt(0, matrix);
    const position = new Vector3();
    matrix.decompose(position, new Quaternion(), new Vector3());
    expect([position.x, position.y, position.z]).toEqual([1, 3, 2]);

    const direction = directionOf(group, 0);
    const expected = new Vector3(4, 6, 5).normalize();
    expect(direction.x).toBeCloseTo(expected.x, 6);
    expect(direction.y).toBeCloseTo(expected.y, 6);
    expect(direction.z).toBeCloseTo(expected.z, 6);
  });

  it("keeps O(1) resources while instance count tracks nonzero samples", () => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const vectors = new Float32Array(count * 3);
    const magnitudes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = i;
      positions[i * 3 + 1] = 1;
      positions[i * 3 + 2] = 2;
      vectors[i * 3] = 1;
      vectors[i * 3 + 1] = 0;
      vectors[i * 3 + 2] = 0;
      magnitudes[i] = i % 3 === 0 ? 0 : 1;
    }
    const group = buildVectorFieldGroup({
      id: "vf-n",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples: { positions, vectors, magnitudes, validCount: count, maxMagnitude: 1, cell: 0.5 },
      roughness: 0.6,
      metalness: 0
    });
    // Exactly two meshes sharing one material, regardless of N.
    expect(group.children).toHaveLength(2);
    expect(group.children[0]).toBeInstanceOf(InstancedMesh);
    expect(group.children[1]).toBeInstanceOf(InstancedMesh);
    const shaft = group.children[0] as InstancedMesh;
    const head = group.children[1] as InstancedMesh;
    expect(shaft.material).toBe(head.material);
    // Zero-magnitude every third sample skipped.
    const expected = count - Math.ceil(count / 3);
    expect(getVectorFieldInstanceCount(group)).toBe(expected);
    expect(head.count).toBe(expected);
  });

  it("differentiates lengths with normalize OFF and equalizes with ON", () => {
    const samples: VectorFieldSampleData = {
      positions: new Float32Array([0, 0, 0, 1, 0, 0]),
      vectors: new Float32Array([1, 0, 0, 2, 0, 0]),
      magnitudes: new Float32Array([1, 2]),
      validCount: 2,
      maxMagnitude: 2,
      cell: 1
    };
    const relative = buildVectorFieldGroup({
      id: "vf-r",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples,
      roughness: 0.6,
      metalness: 0
    });
    // mag 1 of ref 2 -> half-cell; mag 2 -> full cell.
    expect(shaftLengthOf(relative, 0)).toBeCloseTo(0.5, 6);
    expect(shaftLengthOf(relative, 1)).toBeCloseTo(1, 6);

    const normalized = buildVectorFieldGroup({
      id: "vf-n2",
      color: "#3b82f6",
      scale: 1,
      normalize: true,
      samples,
      roughness: 0.6,
      metalness: 0
    });
    expect(shaftLengthOf(normalized, 0)).toBeCloseTo(1, 6);
    expect(shaftLengthOf(normalized, 1)).toBeCloseTo(1, 6);
    // Direction identical in both modes.
    expect(directionOf(relative, 0).toArray()).toEqual(directionOf(normalized, 0).toArray());
  });

  it("caps extreme magnitudes at one cell and survives antiparallel quaternions", () => {
    const samples: VectorFieldSampleData = {
      // World direction will be (0,-1,0): the setFromUnitVectors degenerate.
      positions: new Float32Array([0, 0, 0, 0, 0, 0]),
      vectors: new Float32Array([0, 0, -5, 1e8, 0, 0]),
      magnitudes: new Float32Array([5, 1e8]),
      validCount: 2,
      maxMagnitude: 1e8,
      cell: 0.5
    };
    const group = buildVectorFieldGroup({
      id: "vf-c",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples,
      roughness: 0.6,
      metalness: 0
    });
    expect(getVectorFieldInstanceCount(group)).toBe(2);
    const direction = directionOf(group, 0);
    expect([direction.x, direction.y, direction.z]).toEqual([0, -1, 0]);
    for (const child of group.children) {
      const mesh = child as InstancedMesh;
      const matrix = new Matrix4();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        for (const value of matrix.elements) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
    // 1e8 of ref 1e8 -> full cell (capped, not world-spanning).
    expect(shaftLengthOf(group, 1)).toBeCloseTo(0.5, 6);
  });

  it("computes instance-covering bounds and disables raycast", () => {
    const group = buildVectorFieldGroup({
      id: "vf-b",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples: makeSamples(),
      roughness: 0.6,
      metalness: 0
    });
    const shaft = group.children[0] as InstancedMesh;
    const head = group.children[1] as InstancedMesh;
    expect(shaft.boundingSphere).not.toBeNull();
    expect(head.boundingSphere).not.toBeNull();
    // Shaft sphere covers the instance base; head sphere covers the tip.
    expect(shaft.boundingSphere!.distanceToPoint(new Vector3(1, 3, 2))).toBeLessThanOrEqual(0);
    const tip = new Vector3(1, 3, 2).add(directionOf(group, 0).multiplyScalar(0.5));
    expect(head.boundingSphere!.distanceToPoint(tip)).toBeLessThanOrEqual(0);
    // S20-R11: bound the bound — head sphere radius stays within one cell,
    // and the base lies outside the head sphere (no over-covering).
    expect(head.boundingSphere!.radius).toBeLessThanOrEqual(0.5);
    expect(head.boundingSphere!.distanceToPoint(new Vector3(1, 3, 2))).toBeGreaterThan(0);
    for (const mesh of [shaft, head]) {
      // Glyphs never intercept picking: ray straight at the instance hits nothing.
      const raycaster = new Raycaster(new Vector3(1, 10, 2), new Vector3(0, -1, 0));
      expect(raycaster.intersectObject(mesh, false)).toEqual([]);
    }
    expect(group.userData.vinculumId).toBe("vf-b");
  });

  it("builds an empty-but-owned group for all-zero fields and rewrites on render change", () => {
    const samples = makeSamples({
      vectors: new Float32Array([0, 0, 0, 0, 0, 0]),
      magnitudes: new Float32Array([0, 0]),
      maxMagnitude: 0
    });
    const group = buildVectorFieldGroup({
      id: "vf-z",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples,
      roughness: 0.6,
      metalness: 0
    });
    expect(getVectorFieldInstanceCount(group)).toBe(0);
    // Cache retained: a normalize toggle recomputes with zero jobs involved.
    expect(writeVectorFieldInstances(group, 2, true)).toBe(0);
    expect(group.userData.vectorFieldRender).toEqual({ scale: 2, normalize: true });
  });

  it("returns -1 for nodes without a field cache", () => {
    expect(writeVectorFieldInstances(new Group(), 1, false)).toBe(-1);
    expect(getVectorFieldNode(undefined)).toBeNull();
    expect(getVectorFieldNode(new Group())).toBeNull();
    const group = buildVectorFieldGroup({
      id: "vf-g",
      color: "#3b82f6",
      scale: 1,
      normalize: false,
      samples: makeSamples(),
      roughness: 0.6,
      metalness: 0
    });
    expect(getVectorFieldNode(group)).toBe(group);
  });
});
