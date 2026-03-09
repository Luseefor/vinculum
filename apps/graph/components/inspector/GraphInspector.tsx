"use client";

import { useMemo } from "react";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card id="graph-inspector" className="rounded-xl border-border/80 bg-card">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Select an expression to inspect graph settings.
        </CardContent>
      </Card>
    );
  }

  const selectedIndex = objects.findIndex((object) => object.id === selectedObject.id);
  const selectedTitle = selectedIndex >= 0 ? `Expression ${selectedIndex + 1}` : "Selected Expression";

  if (selectedObject.kind !== "surface") {
    return (
      <Card id="graph-inspector" className="rounded-xl border-border/80 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[0.78rem] uppercase tracking-[0.28em] text-muted-foreground">Inspector</CardTitle>
          <CardDescription className="flex items-center gap-2 text-base font-medium text-foreground">
            <span
              className="h-3 w-3 rounded-full border border-foreground/20"
              style={{ backgroundColor: selectedObject.color }}
            />
            {selectedTitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-[0.95rem] text-muted-foreground">
          Detailed controls are currently available for surface graphs.
        </CardContent>
      </Card>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;

  return (
    <section id="graph-inspector" className="space-y-2.5">
      <Card className="rounded-xl border-border/80 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[0.78rem] uppercase tracking-[0.28em] text-muted-foreground">Inspector</CardTitle>
          <CardDescription className="flex items-center gap-2 text-base font-medium text-foreground">
            <span
              className="h-3 w-3 rounded-full border border-foreground/20"
              style={{ backgroundColor: selectedSurfaceObject.color }}
            />
            {selectedTitle}
          </CardDescription>
        </CardHeader>
      </Card>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}
