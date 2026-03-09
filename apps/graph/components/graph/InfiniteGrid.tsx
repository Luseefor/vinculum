"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh, ShaderMaterial } from "three";
import { Color, DoubleSide, Vector2, Vector3 } from "three";
import { useAdaptiveGrid } from "@/hooks/useAdaptiveGrid";

const VERTEX_SHADER = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT_SHADER = `
uniform float uMinorStep;
uniform float uMajorStep;
uniform float uFadeDistance;
uniform vec2 uGridOffset;
uniform vec3 uCameraPosition;
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;

varying vec3 vWorldPosition;

float lineIntensity(vec2 coord, float step) {
  vec2 scaled = coord / step;
  vec2 grid = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), vec2(0.0001));
  float dist = min(grid.x, grid.y);
  return 1.0 - min(dist, 1.0);
}

void main() {
  float safeMinorStep = max(uMinorStep, 0.0001);
  float safeMajorStep = max(uMajorStep, 0.0001);

  vec2 gridCoord = vWorldPosition.xz - uGridOffset;
  float major = lineIntensity(gridCoord, safeMajorStep);
  float minor = lineIntensity(gridCoord, safeMinorStep);
  float minorMasked = minor * (1.0 - major);

  float radialDistance = distance(vWorldPosition.xz, uCameraPosition.xz);
  float fade = 1.0 - smoothstep(uFadeDistance * 0.2, uFadeDistance, radialDistance);

  vec3 color = (uMinorColor * minorMasked) + (uMajorColor * major);
  float alpha = ((minorMasked * 0.48) + (major * 0.92)) * fade;

  if (alpha <= 0.002) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
`;

export default function InfiniteGrid() {
  const meshRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);

  const { majorStep, minorStep, fadeDistance, gridOffset } = useAdaptiveGrid();

  const uniforms = useMemo(
    () => ({
      uMinorStep: { value: minorStep },
      uMajorStep: { value: majorStep },
      uFadeDistance: { value: fadeDistance },
      uGridOffset: { value: new Vector2(gridOffset[0], gridOffset[1]) },
      uCameraPosition: { value: new Vector3() },
      uMinorColor: { value: new Color("#1f2937") },
      uMajorColor: { value: new Color("#334155") }
    }),
    []
  );

  useEffect(() => {
    const material = materialRef.current;
    if (!material) {
      return;
    }

    material.uniforms.uMinorStep.value = minorStep;
    material.uniforms.uMajorStep.value = majorStep;
    material.uniforms.uFadeDistance.value = fadeDistance;
    // Offset keeps shader coordinates numerically stable and can map to a future world-origin shift.
    material.uniforms.uGridOffset.value.set(gridOffset[0], gridOffset[1]);
  }, [fadeDistance, gridOffset, majorStep, minorStep]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.set(camera.position.x, -0.001, camera.position.z);
      const diameter = fadeDistance * 2;
      mesh.scale.set(diameter, diameter, 1);
    }

    const material = materialRef.current;
    if (material) {
      material.uniforms.uCameraPosition.value.copy(camera.position);
    }
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        side={DoubleSide}
        transparent
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
      />
    </mesh>
  );
}
