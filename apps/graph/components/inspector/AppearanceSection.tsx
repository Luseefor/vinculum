"use client";

import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { cx } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

interface AppearanceSectionProps {
  object: SurfaceGraphObject;
}

export default function AppearanceSection({ object }: AppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <section className="panel p-3">
      <h4 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
        Appearance
      </h4>

      <div className="panel-inset p-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Surface color"
          value={object.color}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="color-swatch w-6 h-6"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[var(--text-primary)]">Color</p>
          <p className="font-mono text-[9px] text-[var(--text-tertiary)] truncate">{object.color}</p>
        </div>
      </div>

      <div className="panel-inset p-2 mt-1.5 flex items-center justify-between">
        <p className="text-[10px] font-medium text-[var(--text-primary)]">Wireframe</p>
        <button
          type="button"
          onClick={() => toggleSurfaceWireframe(object.id)}
          aria-pressed={object.appearance.wireframe}
          className={cx(
            "w-8 h-4 rounded-full relative transition-colors",
            object.appearance.wireframe
              ? "bg-[var(--accent)]"
              : "bg-black/25"
          )}
        >
          <span
            className={cx(
              "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
              object.appearance.wireframe ? "left-[18px]" : "left-0.5"
            )}
          />
        </button>
      </div>
    </section>
  );
}
