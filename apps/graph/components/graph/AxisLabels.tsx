"use client";

import { Html } from "@react-three/drei";

const LABEL_DISTANCE = 6;

export default function AxisLabels() {
  return (
    <group>
      <AxisLabel position={[LABEL_DISTANCE, 0, 0]} text="X" />
      <AxisLabel position={[0, LABEL_DISTANCE, 0]} text="Y" />
      <AxisLabel position={[0, 0, LABEL_DISTANCE]} text="Z" />
    </group>
  );
}

interface AxisLabelProps {
  position: [number, number, number];
  text: string;
}

function AxisLabel({ position, text }: AxisLabelProps) {
  return (
    <Html position={position} transform sprite distanceFactor={8}>
      <div className="pointer-events-none rounded border border-slate-700/70 bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-200 shadow-sm">
        {text}
      </div>
    </Html>
  );
}
