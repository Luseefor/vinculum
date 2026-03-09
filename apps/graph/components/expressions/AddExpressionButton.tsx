"use client";

import { useState } from "react";
import type { GraphObjectKind } from "@vinculum/scene/types";
import { ui, cx } from "@/components/ui/styles";
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
    <div className="flex items-center gap-2">
      <select
        value={graphType}
        onChange={(event) => setGraphType(event.target.value as GraphObjectKind)}
        className={cx(ui.selectBase, "h-9 min-w-0 flex-1 uppercase tracking-wide")}
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
        className={cx(ui.buttonBase, ui.buttonSubtle, "h-9 shrink-0 px-3 text-sm")}
      >
        Add
      </button>
    </div>
  );
}
