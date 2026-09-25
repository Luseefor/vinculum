"use client";

import type { GraphObjectKind, VectorFieldDimension } from "@vinculum/scene/types";
import { parseGraphObjectKind } from "@/lib/graph/graphObjectKind";

interface GraphTypeSelectorProps {
  value: GraphObjectKind;
  dimension?: VectorFieldDimension;
  onChange: (kind: GraphObjectKind, dimension?: VectorFieldDimension) => void;
}

const GRAPH_TYPE_OPTIONS: Array<{
  label: string;
  value: string;
  kind: GraphObjectKind;
  dimension?: VectorFieldDimension;
}> = [
  { label: "Surface", value: "surface", kind: "surface" },
  { label: "Curve", value: "parametricCurve", kind: "parametricCurve" },
  { label: "Parametric Surface", value: "parametricSurface", kind: "parametricSurface" },
  { label: "Implicit Surface", value: "implicitSurface", kind: "implicitSurface" },
  { label: "Plane", value: "plane", kind: "plane" },
  { label: "Point", value: "point", kind: "point" },
  { label: "Vector", value: "vector", kind: "vector" },
  { label: "Line", value: "line", kind: "line" },
  { label: "Ray", value: "ray", kind: "ray" },
  { label: "Segment", value: "segment", kind: "segment" },
  { label: "2D Vector Field", value: "vectorField:2d", kind: "vectorField", dimension: "2d" },
  { label: "3D Vector Field", value: "vectorField:3d", kind: "vectorField", dimension: "3d" }
];

export default function GraphTypeSelector({ value, dimension, onChange }: GraphTypeSelectorProps) {
  const selectValue = value === "vectorField" ? `vectorField:${dimension ?? "2d"}` : value;

  return (
    <select
      value={selectValue}
      onChange={(event) => {
        const selected = GRAPH_TYPE_OPTIONS.find((option) => option.value === event.target.value);
        if (selected) {
          onChange(selected.kind, selected.dimension);
          return;
        }
        const kind = parseGraphObjectKind(event.target.value);
        if (kind) {
          onChange(kind);
        }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="h-7 w-auto cursor-pointer rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
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
