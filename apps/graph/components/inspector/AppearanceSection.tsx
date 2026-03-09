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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Appearance</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        <div className="flex items-center justify-between rounded-md border border-border/80 bg-background/80 px-2.5 py-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Selected graph color"
              value={object.color}
              onChange={(event) => updateObjectColor(object.id, event.target.value)}
              className="h-8 w-8 cursor-pointer rounded-md border border-border bg-transparent p-0"
            />
            <div>
              <p className="text-sm font-medium">Graph Color</p>
              <p className="font-mono text-xs text-muted-foreground">{object.color}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/80 bg-background/80 px-2.5 py-2">
          <div>
            <p className="text-sm font-medium">Wireframe</p>
            <p className="text-xs text-muted-foreground">Toggle mesh edge rendering.</p>
          </div>
          <Button
            type="button"
            variant={object.appearance.wireframe ? "default" : "outline"}
            size="sm"
            onClick={() => toggleSurfaceWireframe(object.id)}
            aria-pressed={object.appearance.wireframe}
          >
            {object.appearance.wireframe ? "On" : "Off"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
