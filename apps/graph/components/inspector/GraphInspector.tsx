"use client";

import { useMemo } from "react";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { ui } from "@/components/ui/styles";
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
      <section
        id="graph-inspector"
        className={ui.panelMuted + " border-dashed px-3 py-4 text-xs text-slate-500"}
      >
        Select an expression row to inspect graph settings.
      </section>
    );
  }

  if (selectedObject.kind !== "surface") {
    return (
      <section id="graph-inspector" className={ui.panel + " px-3 py-3"}>
        <p className={ui.sectionTitle}>Inspector</p>
        <p className="mt-1 text-sm font-medium text-slate-200">
          {selectedObject.kind === "parametricCurve" ? "Parametric Curve" : "Plane"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Detailed inspector controls are currently available for surface graphs. Row-level editing for
          this type is active.
        </p>
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `Expression ${selectedIndex + 1}` : "Selected Expression";

  return (
    <section id="graph-inspector" className="space-y-2.5">
      <div className={ui.panel + " px-3 py-2.5"}>
        <p className={ui.sectionTitle}>Inspector</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-slate-700" style={{ backgroundColor: selectedSurfaceObject.color }} />
          <p className="text-sm font-medium text-slate-200">{selectedTitle}</p>
        </div>
      </div>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}
