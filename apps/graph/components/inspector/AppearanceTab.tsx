"use client";

import { useMemo } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import AppearanceSection from "./AppearanceSection";
import TessellationSection from "./TessellationSection";
import VectorFieldAppearanceSection from "./VectorFieldAppearanceSection";

export default function AppearanceTab() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);
  const selectedObject = useMemo<GraphObject | null>(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  if (!selectedObject) {
    return (
      <section className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border-subtle)] bg-transparent p-3">
        <header>
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Appearance</h3>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to edit style controls.</p>
        </header>
      </section>
    );
  }

  if (
    selectedObject.kind === "surface" ||
    selectedObject.kind === "parametricSurface" ||
    selectedObject.kind === "implicitSurface"
  ) {
    return (
      <div className="flex flex-col gap-6">
        <AppearanceSection object={selectedObject} />
        <TessellationSection object={selectedObject} />
      </div>
    );
  }

  // S20: fields carry color + render-only glyph sizing (no wireframe).
  if (selectedObject.kind === "vectorField") {
    return (
      <div className="flex flex-col gap-6">
        <VectorFieldAppearanceSection object={selectedObject} />
      </div>
    );
  }

  return (
    <section className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0">
      <header>
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Appearance</h3>
      </header>
      <div className="space-y-3 pt-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Color</span>
          <Input
            type="color"
            value={selectedObject.color}
            onChange={(event) => updateObjectColor(selectedObject.id, event.target.value)}
            className="h-8 w-full rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2"
          />
        </label>
        {selectedObject.kind === "plane" && (
          <div className="mt-2 flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2">
            <span className="text-[12px] text-[var(--text-secondary)]">Toggle Wireframe</span>
            <Switch
              checked={selectedObject.appearance.wireframe}
              onCheckedChange={() => toggleSurfaceWireframe(selectedObject.id)}
              ariaLabel="Toggle Wireframe"
            />
          </div>
        )}
      </div>
    </section>
  );
}
