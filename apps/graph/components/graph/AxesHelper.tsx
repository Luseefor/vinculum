"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";

const AXIS_EXTENT = 120;

export default function AxesHelper() {
  const geometry = useMemo(() => createAxisGeometry(AXIS_EXTENT), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={2}>
        <lineBasicMaterial transparent opacity={0.88} vertexColors />
      </lineSegments>
      <mesh position={[0, 0, 0]} renderOrder={3}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

function createAxisGeometry(extent: number): BufferGeometry {
  const segments = [
    { from: [-extent, 0, 0], to: [0, 0, 0], color: [0.17, 0.2, 0.27] },
    { from: [0, 0, 0], to: [extent, 0, 0], color: [0.62, 0.37, 0.37] },
    { from: [0, -extent, 0], to: [0, 0, 0], color: [0.17, 0.2, 0.27] },
    { from: [0, 0, 0], to: [0, extent, 0], color: [0.4, 0.56, 0.4] },
    { from: [0, 0, -extent], to: [0, 0, 0], color: [0.17, 0.2, 0.27] },
    { from: [0, 0, 0], to: [0, 0, extent], color: [0.38, 0.5, 0.66] }
  ] as const;

  const positions: number[] = [];
  const colors: number[] = [];

  for (const segment of segments) {
    positions.push(...segment.from, ...segment.to);
    colors.push(...segment.color, ...segment.color);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}
