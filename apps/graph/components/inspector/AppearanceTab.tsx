"use client";

import { useMemo } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { useGraphStore } from "@/store/graphStore";
import AppearanceSection from "./AppearanceSection";

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
      <section className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-3">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Appearance</h3>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to edit appearance controls.</p>
      </section>
    );
  }

  if (selectedObject.kind === "surface") {
    return <AppearanceSection object={selectedObject} />;
  }

  return (
    <section className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-3">
      <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Appearance</h3>
      <label className="block space-y-1">
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Color</span>
        <Input
          type="color"
          value={selectedObject.color}
          onChange={(event) => updateObjectColor(selectedObject.id, event.target.value)}
          className="h-9 w-full rounded border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2"
        />
      </label>
      {selectedObject.kind === "plane" && (
        <button
          type="button"
          onClick={() => toggleSurfaceWireframe(selectedObject.id)}
          className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
        >
          Toggle Wireframe
        </button>
      )}
    </section>
  );
}
