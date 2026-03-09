"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGraphStore } from "@/store/graphStore";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <Card className="rounded-xl border-border/80 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-[0.78rem] uppercase tracking-[0.28em] text-muted-foreground">Appearance</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/90 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Selected graph color"
              value={object.color}
              onChange={(event) => updateObjectColor(object.id, event.target.value)}
              className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0"
            />
            <div>
              <p className="text-[0.95rem] font-medium">Graph Color</p>
              <p className="font-mono text-[0.85rem] text-muted-foreground">{object.color}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-background/90 px-2.5 py-2">
          <div>
            <p className="text-[0.95rem] font-medium">Wireframe</p>
            <p className="text-[0.85rem] text-muted-foreground">Toggle mesh edge rendering.</p>
          </div>
          <Button
            type="button"
            variant={object.appearance.wireframe ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-lg border-border/80 px-2.5"
            onClick={() => toggleSurfaceWireframe(object.id)}
            aria-pressed={object.appearance.wireframe}
          >
            {object.appearance.wireframe ? "ON" : "OFF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
