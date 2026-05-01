"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Appearance</h4>
      
      <div className="flex flex-col gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Material</p>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
              <input
                type="color"
                aria-label="Surface color"
                value={object.color}
                onChange={(event) => updateObjectColor(object.id, event.target.value)}
                className="h-8 w-8 cursor-pointer rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-0.5"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Color</p>
                <p className="font-mono text-[11px] text-[var(--text-tertiary)]">{object.color}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
              <div>
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Wireframe</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">Render with edge-only topology</p>
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
