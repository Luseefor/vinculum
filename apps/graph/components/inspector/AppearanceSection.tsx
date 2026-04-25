"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { cn } from "@/components/ui/styles";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <section className="flex flex-col gap-4">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Appearance</h4>
      
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-primary)] shadow-sm">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Material</p>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
              <input
                type="color"
                aria-label="Surface color"
                value={object.color}
                onChange={(event) => updateObjectColor(object.id, event.target.value)}
                className="h-9 w-9 cursor-pointer rounded-md border border-[var(--border-strong)] bg-white p-0.5"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">Color</p>
                <p className="font-mono text-[10px] font-medium text-[var(--text-tertiary)]">{object.color}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
              <div>
                <p className="text-[11px] font-bold text-[var(--text-primary)]">Wireframe</p>
                <p className="text-[9px] font-medium text-[var(--text-tertiary)]">Render with edge-only topology</p>
              </div>
              <Switch
                checked={object.appearance.wireframe}
                onCheckedChange={() => toggleSurfaceWireframe(object.id)}
                ariaLabel={object.appearance.wireframe ? "Disable wireframe" : "Enable wireframe"}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
