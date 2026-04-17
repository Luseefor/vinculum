"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Group } from "three";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";

const BASE_AXIS_EXTENT = 120;

export default function AxesHelper() {
  const { camera } = useThree();
  const groupRef = useRef<Group | null>(null);
  const resolvedTheme = useResolvedTheme();
  const tokens = useMemo(() => getGraphThemeTokens(resolvedTheme), [resolvedTheme]);
  const colors = useMemo(
    () => ({
      negative: tokens.axisNegativeRgb,
      xPositive: tokens.axisXPositiveRgb,
      yPositive: tokens.axisYPositiveRgb,
      zPositive: tokens.axisZPositiveRgb,
      origin: tokens.axisOrigin
    }),
    [tokens.axisNegativeRgb, tokens.axisOrigin, tokens.axisXPositiveRgb, tokens.axisYPositiveRgb, tokens.axisZPositiveRgb]
  );
  const geometry = useMemo(
    () =>
      createAxisGeometry(BASE_AXIS_EXTENT, {
        negative: colors.negative,
        xPositive: colors.xPositive,
        yPositive: colors.yPositive,
        zPositive: colors.zPositive
      }),
    [colors.negative, colors.xPositive, colors.yPositive, colors.zPositive]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    const scale = computeAxisScale(camera.position.x, camera.position.y, camera.position.z);
    group.scale.set(scale, scale, scale);
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometry} renderOrder={2}>
        <lineBasicMaterial transparent opacity={0.88} vertexColors />
      </lineSegments>
      <mesh position={[0, 0, 0]} renderOrder={3}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={colors.origin} transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function computeAxisScale(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 5));
}

function createAxisGeometry(
  extent: number,
  axisColors: {
    negative: [number, number, number];
    xPositive: [number, number, number];
    yPositive: [number, number, number];
    zPositive: [number, number, number];
  }
): BufferGeometry {
  const segments = [
    { from: [-extent, 0, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [extent, 0, 0], color: axisColors.xPositive },
    { from: [0, -extent, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, extent, 0], color: axisColors.yPositive },
    { from: [0, 0, -extent], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, 0, extent], color: axisColors.zPositive }
  ] as const;

  const positions: number[] = [];
  const colorBuffer: number[] = [];

  for (const segment of segments) {
    positions.push(...segment.from, ...segment.to);
    colorBuffer.push(...segment.color, ...segment.color);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colorBuffer), 3));
  return geometry;
}
