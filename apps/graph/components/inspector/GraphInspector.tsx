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
      <section
        id="graph-inspector"
        className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-5 text-center"
      >
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to edit its properties.</p>
      </section>
    );
  }

  if (selectedObject.kind !== "surface") {
    return (
      <section id="graph-inspector" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-4">
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
          {selectedObject.kind === "parametricCurve" ? "Curve" : "Plane"} selected
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Advanced controls are available for surfaces in this panel.
        </p>
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";

  return (
    <section id="graph-inspector" className="space-y-2">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: selectedSurfaceObject.color }}
          />
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
            Surface {selectedTitle}
          </h3>
        </div>
      </div>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}
