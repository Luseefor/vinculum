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
      <section id="graph-inspector" className="panel-inset px-3 py-4 text-center">
        <p className="text-[10px] text-[var(--text-tertiary)]">Select to inspect</p>
      </section>
    );
  }

  if (selectedObject.kind !== "surface") {
    return (
      <section id="graph-inspector" className="panel px-3 py-2.5">
        <h3 className="text-[10px] font-semibold text-[var(--text-primary)]">
          {selectedObject.kind === "parametricCurve" ? "Curve" : "Plane"}
        </h3>
        <p className="mt-1 text-[9px] text-[var(--text-tertiary)] leading-relaxed">
          Inspector available for surfaces
        </p>
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";

  return (
    <section id="graph-inspector" className="space-y-1.5">
      <div className="panel px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: selectedSurfaceObject.color }}
          />
          <h3 className="text-[10px] font-semibold text-[var(--text-primary)]">
            Surface {selectedTitle}
          </h3>
        </div>
      </div>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}
