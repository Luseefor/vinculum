"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color } from "three";
import type { ViewportMode } from "@/types/graphUi";

const AXIS_EXTENT = 140;

interface AxesHelperProps {
  viewportMode: ViewportMode;
  theme: "light" | "dark";
}

interface AxisColors {
  faded: Color;
  x: Color;
  y: Color;
  z: Color;
  origin: Color;
}

export default function AxesHelper({ viewportMode, theme }: AxesHelperProps) {
  const colors = useMemo<AxisColors>(
    () =>
      theme === "light"
        ? {
            faded: new Color("#b0bccd"),
            x: new Color("#c75d5d"),
            y: new Color("#4f8a5e"),
            z: new Color("#4a78b5"),
            origin: new Color("#6b7280")
          }
        : {
            faded: new Color("#334155"),
            x: new Color("#b95f5f"),
            y: new Color("#4d7a57"),
            z: new Color("#5b83bb"),
            origin: new Color("#64748b")
          },
    [theme]
  );

  const geometry = useMemo(
    () => createAxisGeometry(AXIS_EXTENT, viewportMode, colors),
    [colors, viewportMode]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={2}>
        <lineBasicMaterial transparent opacity={0.9} vertexColors />
      </lineSegments>
      <mesh position={[0, 0, 0]} renderOrder={3}>
        <sphereGeometry args={[0.048, 10, 10]} />
        <meshBasicMaterial color={colors.origin} transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

function createAxisGeometry(extent: number, mode: ViewportMode, colors: AxisColors): BufferGeometry {
  const segments: Array<{
    from: [number, number, number];
    to: [number, number, number];
    color: Color;
  }> = [
    { from: [-extent, 0, 0], to: [0, 0, 0], color: colors.faded },
    { from: [0, 0, 0], to: [extent, 0, 0], color: colors.x },
    { from: [0, 0, -extent], to: [0, 0, 0], color: colors.faded },
    { from: [0, 0, 0], to: [0, 0, extent], color: colors.z }
  ];

  if (mode === "3d") {
    segments.splice(2, 0, { from: [0, -extent, 0], to: [0, 0, 0], color: colors.faded });
    segments.splice(3, 0, { from: [0, 0, 0], to: [0, extent, 0], color: colors.y });
  }

  const positions: number[] = [];
  const colorValues: number[] = [];

  for (const segment of segments) {
    positions.push(...segment.from, ...segment.to);

    const [r, g, b] = segment.color.toArray();
    colorValues.push(r, g, b, r, g, b);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colorValues), 3));
  return geometry;
}
