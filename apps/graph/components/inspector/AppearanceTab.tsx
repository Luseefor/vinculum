"use client";

import { useMemo } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <Card className="border-dashed border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-none">
        <CardHeader className="p-3">
          <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Styles</h3>
          <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to edit style controls.</p>
        </CardHeader>
      </Card>
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
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="p-3 pb-0">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Styles</h3>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-3">
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
          <div className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2.5 mt-2">
            <span className="text-[11px] text-[var(--text-secondary)]">Toggle Wireframe</span>
            <Switch
              checked={selectedObject.appearance.wireframe}
              onCheckedChange={() => toggleSurfaceWireframe(selectedObject.id)}
              ariaLabel="Toggle Wireframe"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
