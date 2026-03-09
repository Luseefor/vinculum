"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { GraphObjectKind } from "@vinculum/scene/types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useGraphStore } from "@/store/graphStore";

const ADD_TYPE_OPTIONS: Array<{ label: string; value: GraphObjectKind }> = [
  { label: "SURFACE", value: "surface" },
  { label: "PARAMETRIC CURVE", value: "parametricCurve" },
  { label: "PLANE", value: "plane" }
];

export default function AddExpressionButton() {
  const [graphType, setGraphType] = useState<GraphObjectKind>("surface");

  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);

  const addObject = () => {
    let createdId = "";

    if (graphType === "parametricCurve") {
      createdId = addParametricCurve();
    } else if (graphType === "plane") {
      createdId = addPlaneObject();
    } else {
      createdId = addSurfaceObject();
    }

    if (createdId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vinculum:focus-expression", {
          detail: { id: createdId }
        })
      );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        value={graphType}
        onChange={(event) => setGraphType(event.target.value as GraphObjectKind)}
        className="h-11 flex-1 rounded-lg border-border/80 bg-background/95 text-[0.95rem] font-semibold tracking-[0.08em]"
        aria-label="Graph type to add"
      >
        {ADD_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>

      <Button
        type="button"
        variant="outline"
        onClick={addObject}
        className="h-11 gap-1.5 rounded-lg border-border/80 px-4 text-[1.05rem]"
      >
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </div>
  );
}
