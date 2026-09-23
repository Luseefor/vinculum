"use client";

import { useState } from "react";
import type { GraphObjectKind, VectorFieldDimension } from "@vinculum/scene/types";
import { parseGraphObjectKind } from "@/lib/graph/graphObjectKind";
import { useGraphStore } from "@/store/graphStore";

const ADD_TYPE_OPTIONS: Array<{
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
  { label: "2D Vector Field", value: "vectorField:2d", kind: "vectorField", dimension: "2d" },
  { label: "3D Vector Field", value: "vectorField:3d", kind: "vectorField", dimension: "3d" }
];

export default function AddExpressionButton() {
  const [graphType, setGraphType] = useState<string>("surface");

  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);

  const selected = ADD_TYPE_OPTIONS.find((option) => option.value === graphType) ?? ADD_TYPE_OPTIONS[0]!;

  const addObject = () => {
    const id = addEmptyObject();
    if (selected.value !== "surface") {
      setObjectKind(id, selected.kind, selected.dimension);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <select
        value={graphType}
        onChange={(event) => {
          const selected = ADD_TYPE_OPTIONS.find((option) => option.value === event.target.value);
          if (selected) {
            setGraphType(selected.value);
            return;
          }
          const kind = parseGraphObjectKind(event.target.value);
          if (kind) {
            setGraphType(kind);
          }
        }}
        className="input h-9 rounded-md border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 py-2 text-[12px] font-medium cursor-pointer"
        aria-label="Graph type to add"
      >
        {ADD_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={addObject}
        className="btn h-9 rounded-md border-[var(--border-subtle)] px-3 text-[12px] font-semibold"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add
      </button>
    </div>
  );
}
