"use client";

import { useMemo } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import AppearanceSection from "./AppearanceSection";
import TessellationSection from "./TessellationSection";

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
      <section className="rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-transparent p-3">
        <header>
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Styles</h3>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to edit style controls.</p>
        </header>
      </section>
    );
  }

  if (selectedObject.kind === "surface") {
    return (
      <div className="flex flex-col gap-6">
        <TessellationSection object={selectedObject} />
        <AppearanceSection object={selectedObject} />
      </div>
    );
  }

  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header>
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Styles</h3>
      </header>
      <div className="space-y-3 pt-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Color</span>
          <Input
            type="color"
            value={selectedObject.color}
            onChange={(event) => updateObjectColor(selectedObject.id, event.target.value)}
            className="h-8 w-full rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2"
          />
        </label>
        {selectedObject.kind === "plane" && (
          <div className="mt-2 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-3 py-2">
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
