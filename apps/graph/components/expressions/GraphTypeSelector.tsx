"use client";

import type { GraphObjectKind } from "@vinculum/scene/types";
import { ui, cx } from "@/components/ui/styles";

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
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as GraphObjectKind)}
      className={cx(ui.selectBase, "px-1.5 py-0.5 text-[10px] uppercase tracking-wide")}
      aria-label="Graph type"
    >
      {GRAPH_TYPE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
