"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGraphStore } from "@/store/graphStore";
import { cn } from "@/lib/utils";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  const isWireframe = object.appearance.wireframe;

  return (
    <Card className="skeuo-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-[0.74rem] uppercase tracking-[0.3em] text-muted-foreground">Appearance</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        <div className="skeuo-inset flex items-center justify-between px-2.5 py-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Selected graph color"
              value={object.color}
              onChange={(event) => updateObjectColor(object.id, event.target.value)}
              className="h-9 w-9 cursor-pointer rounded-md border border-border/80 bg-transparent p-0 shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.18)]"
            />
            <div>
              <p className="text-[0.9rem] font-medium">Graph Color</p>
              <p className="font-mono text-[0.82rem] text-muted-foreground">{object.color}</p>
            </div>
          </div>
        </div>

        <div className="skeuo-inset px-2.5 py-2">
          <p className="text-[0.74rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Mesh Mode</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (isWireframe) {
                  toggleSurfaceWireframe(object.id);
                }
              }}
              className={cn(
                "skeuo-pill flex items-center gap-2 px-3 py-2 text-[0.82rem] font-semibold tracking-wide",
                !isWireframe && "ring-1 ring-primary/45"
              )}
              aria-pressed={!isWireframe}
            >
              <span className="skeuo-radio flex h-4 w-4 items-center justify-center">
                {!isWireframe ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
              </span>
              Shaded
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isWireframe) {
                  toggleSurfaceWireframe(object.id);
                }
              }}
              className={cn(
                "skeuo-pill flex items-center gap-2 px-3 py-2 text-[0.82rem] font-semibold tracking-wide",
                isWireframe && "ring-1 ring-primary/45"
              )}
              aria-pressed={isWireframe}
            >
              <span className="skeuo-radio flex h-4 w-4 items-center justify-center">
                {isWireframe ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
              </span>
              Wireframe
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
