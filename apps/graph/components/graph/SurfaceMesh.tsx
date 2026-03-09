"use client";

import { memo, useEffect, useMemo } from "react";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import * as THREE from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";

interface SurfaceMeshProps {
  object: SurfaceGraphObject;
  resolutionMultiplier: number;
  isInteractive: boolean;
}

function SurfaceMeshComponent({ object, resolutionMultiplier, isInteractive }: SurfaceMeshProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  const adaptiveResolution = useMemo(() => {
    const baseResolution = Math.max(2, Math.floor(object.resolution));
    if (!isInteractive) {
      return baseResolution;
    }

    const scaled = Math.max(8, Math.floor(baseResolution * resolutionMultiplier));
    return Math.min(scaled, 40);
  }, [isInteractive, object.resolution, resolutionMultiplier]);

  const sampled = useMemo(() => {
    const { evaluator, error } = compileSurfaceExpression(object.equation);
    if (error) {
      return null;
    }

    try {
      return sampleSurface(evaluator, {
        domain: object.domain,
        resolution: adaptiveResolution,
        clampHeight: 10_000
      });
    } catch {
      return null;
    }
  }, [adaptiveResolution, object.domain, object.equation]);

  useEffect(() => {
    if (!sampled || sampled.indices.length === 0) {
      geometry.setDrawRange(0, 0);
      return;
    }

    updateFloat32Attribute(geometry, "position", sampled.positions, 3);
    updateIndexAttribute(geometry, sampled.indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const drawCount = geometry.getIndex()?.count ?? 0;
    geometry.setDrawRange(0, drawCount);
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
        roughness={0.35}
        metalness={0.08}
        wireframe={object.appearance.wireframe}
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

const SurfaceMesh = memo(SurfaceMeshComponent);
export default SurfaceMesh;
