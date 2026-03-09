"use client";

import { Html } from "@react-three/drei";
import { cn } from "@/lib/utils";
import type { ViewportMode } from "@/types/graphUi";

const LABEL_DISTANCE = 6;

interface AxisLabelsProps {
  viewportMode: ViewportMode;
  theme: "light" | "dark";
}

export default function AxisLabels({ viewportMode, theme }: AxisLabelsProps) {
  if (viewportMode === "2d") {
    return (
      <group>
        <AxisLabel position={[LABEL_DISTANCE, 0, 0]} text="X" axisColor={theme === "light" ? "#c75d5d" : "#b95f5f"} theme={theme} />
        <AxisLabel position={[0, 0, LABEL_DISTANCE]} text="Y" axisColor={theme === "light" ? "#4a78b5" : "#5b83bb"} theme={theme} />
      </group>
    );
  }

  return (
    <group>
      <AxisLabel position={[LABEL_DISTANCE, 0, 0]} text="X" axisColor={theme === "light" ? "#c75d5d" : "#b95f5f"} theme={theme} />
      <AxisLabel position={[0, LABEL_DISTANCE, 0]} text="Y" axisColor={theme === "light" ? "#4f8a5e" : "#4d7a57"} theme={theme} />
      <AxisLabel position={[0, 0, LABEL_DISTANCE]} text="Z" axisColor={theme === "light" ? "#4a78b5" : "#5b83bb"} theme={theme} />
    </group>
  );
}

interface AxisLabelProps {
  position: [number, number, number];
  text: string;
  axisColor: string;
  theme: "light" | "dark";
}

function AxisLabel({ position, text, axisColor, theme }: AxisLabelProps) {
  return (
    <Html position={position} transform sprite distanceFactor={8}>
      <div
        className={cn(
          "pointer-events-none rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm",
          theme === "light"
            ? "border-slate-300/90 bg-white/92"
            : "border-slate-700/70 bg-slate-950/85"
        )}
        style={{ color: axisColor }}
      >
        {text}
      </div>
    </Html>
  );
}
