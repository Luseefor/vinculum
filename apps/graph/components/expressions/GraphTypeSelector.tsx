"use client";

import type { GraphObjectKind } from "@vinculum/scene/types";
import { NativeSelect } from "@/components/ui/native-select";

interface GraphTypeSelectorProps {
  value: GraphObjectKind;
  onChange: (kind: GraphObjectKind) => void;
}

const GRAPH_TYPE_OPTIONS: Array<{ label: string; value: GraphObjectKind }> = [
  { label: "Surface", value: "surface" },
  { label: "Curve", value: "parametricCurve" },
  { label: "Plane", value: "plane" }
];

export default function GraphTypeSelector({ value, onChange }: GraphTypeSelectorProps) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value as GraphObjectKind)}
      className="h-8 w-[136px] border-border/80 bg-background/90 px-2 text-[11px] font-semibold uppercase tracking-[0.12em]"
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
