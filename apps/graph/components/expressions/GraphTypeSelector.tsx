"use client";

import type { GraphObjectKind } from "@vinculum/scene/types";
import { NativeSelect } from "@/components/ui/native-select";

interface GraphTypeSelectorProps {
  value: GraphObjectKind;
  onChange: (kind: GraphObjectKind) => void;
}

const GRAPH_TYPE_OPTIONS: Array<{ label: string; value: GraphObjectKind }> = [
  { label: "SURFACE", value: "surface" },
  { label: "CURVE", value: "parametricCurve" },
  { label: "PLANE", value: "plane" }
];

export default function GraphTypeSelector({ value, onChange }: GraphTypeSelectorProps) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value as GraphObjectKind)}
      className="h-9 w-[146px] rounded-lg border-border/80 bg-background/95 px-3 text-[0.94rem] font-semibold tracking-[0.08em]"
      aria-label="Graph type"
    >
      {GRAPH_TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
