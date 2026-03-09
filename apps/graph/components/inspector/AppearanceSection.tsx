"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { ui, cx } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <section className={ui.panel + " p-3"}>
      <h4 className={ui.sectionTitle}>Appearance</h4>

      <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-800/80 bg-slate-950/60 px-2.5 py-2">
        <input
          type="color"
          aria-label="Selected graph color"
          value={object.color}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="h-7 w-7 cursor-pointer rounded-md border border-slate-700/90 bg-transparent p-0"
        />
        <div>
          <p className="text-xs font-medium text-slate-300">Surface Color</p>
          <p className="font-mono text-[11px] text-slate-500">{object.color}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-950/60 px-2.5 py-2">
        <div>
          <p className="text-xs font-medium text-slate-300">Wireframe</p>
          <p className="text-[11px] text-slate-500">Toggle mesh edge rendering.</p>
        </div>
        <button
          type="button"
          onClick={() => toggleSurfaceWireframe(object.id)}
          aria-pressed={object.appearance.wireframe}
          className={cx(ui.buttonBase, ui.buttonSubtle, "px-2 py-1 text-[11px] uppercase tracking-wide")}
        >
          {object.appearance.wireframe ? "On" : "Off"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Additional material controls will be added here in upcoming milestones.
      </p>
    </section>
  );
}
