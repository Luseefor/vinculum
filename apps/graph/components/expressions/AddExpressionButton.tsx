"use client";

import { useState } from "react";
import type { GraphObjectKind } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";

const ADD_TYPE_OPTIONS: Array<{ label: string; value: GraphObjectKind }> = [
  { label: "Surface", value: "surface" },
  { label: "Curve", value: "parametricCurve" },
  { label: "Plane", value: "plane" }
];

export default function AddExpressionButton() {
  const [graphType, setGraphType] = useState<GraphObjectKind>("surface");

  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);

  const addObject = () => {
    if (graphType === "parametricCurve") {
      addParametricCurve();
      return;
    }

    if (graphType === "plane") {
      addPlaneObject();
      return;
    }

    addSurfaceObject();
  };

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <select
        value={graphType}
        onChange={(event) => setGraphType(event.target.value as GraphObjectKind)}
        className="input h-9 rounded-lg border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-[12px] font-medium cursor-pointer"
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
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-hover)]"
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
