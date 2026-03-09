"use client";

import { memo, useEffect, useMemo } from "react";
import type { PlaneGraphObject } from "@vinculum/scene/types";
import * as THREE from "three";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";

interface PlaneMeshProps {
  object: PlaneGraphObject;
  isSelected: boolean;
}

function PlaneMeshComponent({ object, isSelected }: PlaneMeshProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  const sampled = useMemo(() => {
    const compiled = compilePlaneEquation(object.equation);
    if (compiled.error || !compiled.coefficients) {
      return null;
    }

    try {
      return samplePlane(compiled.coefficients, object.size);
    } catch {
      return null;
    }
  }, [object.equation, object.size]);

  useEffect(() => {
    if (!sampled || sampled.indices.length === 0) {
      geometry.setDrawRange(0, 0);
      return;
    }

    updateFloat32Attribute(geometry, "position", sampled.positions, 3);
    updateIndexAttribute(geometry, sampled.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, sampled.indices.length);
  }, [geometry, sampled]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const visible = sampled !== null && sampled.indices.length > 0;

  return (
    <mesh geometry={geometry} visible={visible}>
      <meshStandardMaterial
        color={object.color}
        emissive={object.color}
        emissiveIntensity={isSelected ? 0.2 : 0.08}
        roughness={0.4}
        metalness={0.05}
        transparent
        opacity={isSelected ? 0.9 : 0.76}
        wireframe={object.appearance.wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function updateFloat32Attribute(
  geometry: THREE.BufferGeometry,
  key: "position",
  data: Float32Array,
  itemSize: number
) {
  const existing = geometry.getAttribute(key);
  if (
    existing instanceof THREE.BufferAttribute &&
    existing.array instanceof Float32Array &&
    existing.itemSize === itemSize &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setAttribute(key, new THREE.BufferAttribute(data, itemSize));
}

function updateIndexAttribute(geometry: THREE.BufferGeometry, data: Uint32Array) {
  const existing = geometry.getIndex();
  if (
    existing instanceof THREE.BufferAttribute &&
    existing.array instanceof Uint32Array &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setIndex(new THREE.BufferAttribute(data, 1));
}

const PlaneMesh = memo(PlaneMeshComponent);
export default PlaneMesh;
