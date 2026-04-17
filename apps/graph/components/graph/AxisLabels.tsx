"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group } from "three";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";

const LABEL_DISTANCE = 20;

export default function AxisLabels() {
  const { camera } = useThree();
  const groupRef = useRef<Group | null>(null);
  const resolvedTheme = useResolvedTheme();
  const tokens = useMemo(() => getGraphThemeTokens(resolvedTheme), [resolvedTheme]);
  const labelStyles = useMemo(
    () => ({
      borderColor: tokens.axisLabelBorder,
      backgroundColor: tokens.axisLabelBg,
      color: tokens.axisLabelText
    }),
    [tokens.axisLabelBg, tokens.axisLabelBorder, tokens.axisLabelText]
  );

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
      <AxisLabel position={[LABEL_DISTANCE, 0, 0]} text="X" styles={labelStyles} />
      <AxisLabel position={[0, LABEL_DISTANCE, 0]} text="Y" styles={labelStyles} />
      <AxisLabel position={[0, 0, LABEL_DISTANCE]} text="Z" styles={labelStyles} />
    </group>
  );
}

interface AxisLabelProps {
  position: [number, number, number];
  text: string;
  styles: {
    borderColor: string;
    backgroundColor: string;
    color: string;
  };
}

function AxisLabel({ position, text, styles }: AxisLabelProps) {
  return (
    <Html position={position} transform sprite distanceFactor={10}>
      <div
        className="pointer-events-none rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm"
        style={styles}
      >
        {text}
      </div>
    </Html>
  );
}

function computeAxisScale(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 18));
}
