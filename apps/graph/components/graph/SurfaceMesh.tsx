"use client";

import { memo, useEffect, useMemo } from "react";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import * as THREE from "three";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { sampleSurface } from "@/lib/math/sampleSurface";
import { useGraphStore } from "@/store/graphStore";

interface SurfaceMeshProps {
  object: SurfaceGraphObject;
  isSelected: boolean;
  resolutionMultiplier: number;
  isInteractive: boolean;
}

function SurfaceMeshComponent({ object, isSelected, resolutionMultiplier, isInteractive }: SurfaceMeshProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const viewportMode = useGraphStore((state) => state.ui.viewportMode);
  const surface2DRenderMode = useGraphStore((state) => state.ui.surface2DRenderMode);

  const is2DMode = viewportMode === "2d";
  const useOutlineMaterialIn2D = is2DMode && surface2DRenderMode === "outline";
  const useFillMaterialIn2D = is2DMode && surface2DRenderMode === "fill";

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

  const heightColors = useMemo(() => {
    if (!sampled || sampled.positions.length === 0) {
      return null;
    }

    return createHeightMapColors(sampled.positions, object.color);
  }, [object.color, sampled]);

  useEffect(() => {
    if (!sampled || sampled.indices.length === 0) {
      geometry.setDrawRange(0, 0);
      return;
    }

    updateFloat32Attribute(geometry, "position", sampled.positions, 3);
    updateIndexAttribute(geometry, sampled.indices);
    if (useFillMaterialIn2D && heightColors) {
      updateFloat32Attribute(geometry, "color", heightColors, 3);
    } else {
      geometry.deleteAttribute("color");
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const drawCount = geometry.getIndex()?.count ?? 0;
    geometry.setDrawRange(0, drawCount);
  }, [geometry, heightColors, sampled, useFillMaterialIn2D]);

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
        vertexColors={useFillMaterialIn2D}
        emissive={object.color}
        emissiveIntensity={useOutlineMaterialIn2D ? 0 : is2DMode ? 0.04 : isSelected ? 0.2 : 0.08}
        roughness={useOutlineMaterialIn2D ? 0.85 : is2DMode ? 0.62 : 0.34}
        metalness={0.03}
        transparent={!useOutlineMaterialIn2D}
        opacity={useOutlineMaterialIn2D ? 1 : is2DMode ? 0.9 : isSelected ? 0.96 : 0.84}
        wireframe={is2DMode ? useOutlineMaterialIn2D : object.appearance.wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function updateFloat32Attribute(
  geometry: THREE.BufferGeometry,
  key: "position" | "color",
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

const COLOR_STOPS = [
  { t: 0, color: new THREE.Color("#1d4ed8") },
  { t: 0.33, color: new THREE.Color("#06b6d4") },
  { t: 0.66, color: new THREE.Color("#f59e0b") },
  { t: 1, color: new THREE.Color("#dc2626") }
];

function createHeightMapColors(positions: Float32Array, baseColorHex: string): Float32Array {
  const vertexCount = positions.length / 3;
  const colors = new Float32Array(positions.length);

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < positions.length; i += 3) {
    const y = positions[i];
    if (!Number.isFinite(y)) {
      continue;
    }

    if (y < minY) {
      minY = y;
    }

    if (y > maxY) {
      maxY = y;
    }
  }

  const range = Math.max(1e-6, maxY - minY);
  const gradientColor = new THREE.Color();
  const mixedColor = new THREE.Color();
  const baseColor = new THREE.Color(baseColorHex);

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const y = positions[vertexIndex * 3 + 1];
    const normalized = clamp01((y - minY) / range);
    sampleGradient(normalized, gradientColor);

    mixedColor.copy(gradientColor).lerp(baseColor, 0.18);

    const colorOffset = vertexIndex * 3;
    colors[colorOffset] = mixedColor.r;
    colors[colorOffset + 1] = mixedColor.g;
    colors[colorOffset + 2] = mixedColor.b;
  }

  return colors;
}

function sampleGradient(value: number, out: THREE.Color): THREE.Color {
  const t = clamp01(value);
  let start: { t: number; color: THREE.Color } = COLOR_STOPS[0];
  let end: { t: number; color: THREE.Color } = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
    const current = COLOR_STOPS[i];
    const next = COLOR_STOPS[i + 1];
    if (t >= current.t && t <= next.t) {
      start = current;
      end = next;
      break;
    }
  }

  const segment = Math.max(1e-6, end.t - start.t);
  const localT = (t - start.t) / segment;
  return out.copy(start.color).lerp(end.color, localT);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const SurfaceMesh = memo(SurfaceMeshComponent);
export default SurfaceMesh;
