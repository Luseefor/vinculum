"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { GraphObjectKind } from "@vinculum/scene/types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useGraphStore } from "@/store/graphStore";

const ADD_TYPE_OPTIONS: Array<{ label: string; value: GraphObjectKind }> = [
  { label: "Surface", value: "surface" },
  { label: "Parametric Curve", value: "parametricCurve" },
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
      <NativeSelect
        value={graphType}
        onChange={(event) => setGraphType(event.target.value as GraphObjectKind)}
        className="h-10 flex-1 border-border/80 bg-background/90 text-[11px] font-semibold uppercase tracking-[0.14em]"
        aria-label="Graph type to add"
      >
        {ADD_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>

      <Button type="button" variant="outline" onClick={addObject} className="h-10 gap-1.5 px-3">
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </div>
  );
}
