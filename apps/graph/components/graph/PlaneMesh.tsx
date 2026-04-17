"use client";

import { memo, useEffect, useMemo } from "react";
import type { PlaneGraphObject } from "@vinculum/scene/types";
import * as THREE from "three";
import { compilePlaneEquation, samplePlane } from "@/lib/math/samplePlane";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";

interface PlaneMeshProps {
  object: PlaneGraphObject;
}

function PlaneMeshComponent({ object }: PlaneMeshProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const resolvedTheme = useResolvedTheme();

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
  const planeOpacity = resolvedTheme === "dark" ? 0.62 : 0.56;

  return (
    <mesh geometry={geometry} visible={visible} castShadow={false} receiveShadow={false}>
      <meshBasicMaterial
        color={object.color}
        transparent
        opacity={planeOpacity}
        wireframe={object.appearance.wireframe}
        side={THREE.DoubleSide}
        toneMapped={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
      {!object.appearance.wireframe && (
        <lineSegments geometry={geometry} renderOrder={5}>
          <lineBasicMaterial
            color={resolvedTheme === "dark" ? "#f8fafc" : "#0f172a"}
            transparent
            opacity={resolvedTheme === "dark" ? 0.2 : 0.18}
            depthWrite={false}
          />
        </lineSegments>
      )}
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
