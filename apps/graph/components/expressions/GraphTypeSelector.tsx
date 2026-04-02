"use client";

import type { GraphObjectKind } from "@vinculum/scene/types";

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
      onClick={(e) => e.stopPropagation()}
      className="input py-0.5 px-1.5 text-[10px] w-auto cursor-pointer"
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
