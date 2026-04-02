"use client";

import { useMemo } from "react";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import AppearanceSection from "./AppearanceSection";
import DomainSection from "./DomainSection";

export default function GraphInspector() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);

  const selectedObject = useMemo<GraphObject | null>(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  if (!selectedObject) {
    return (
      <section id="graph-inspector" className="panel-inset px-4 py-6 text-center">
        <p className="text-xs text-[var(--text-tertiary)]">No selection</p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)] opacity-60">
          Select an expression to inspect
        </p>
      </section>
    );
  }

  if (selectedObject.kind !== "surface") {
    return (
      <section id="graph-inspector" className="panel px-4 py-3">
        <h3 className="text-xs font-semibold text-[var(--text-primary)]">
          {selectedObject.kind === "parametricCurve" ? "Parametric Curve" : "Plane"}
        </h3>
        <p className="mt-2 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
          Inspector controls are available for surface graphs. Use row-level editing for this type.
        </p>
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `Expression ${selectedIndex + 1}` : "Selected";

  return (
    <section id="graph-inspector" className="space-y-2">
      <div className="panel px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: selectedSurfaceObject.color }}
          />
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">{selectedTitle}</h3>
        </div>
      </div>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}
