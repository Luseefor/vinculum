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
    <section className="panel p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
        Appearance
      </h4>

      <div className="panel-inset p-3 flex items-center gap-3">
        <input
          type="color"
          aria-label="Selected graph color"
          value={object.color}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="color-swatch w-8 h-8"
        />
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)]">Surface Color</p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)]">{object.color}</p>
        </div>
      </div>

      <div className="panel-inset p-3 mt-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-primary)]">Wireframe</p>
          <p className="text-[11px] text-[var(--text-tertiary)]">Show mesh edges</p>
        </div>
        <button
          type="button"
          onClick={() => toggleSurfaceWireframe(object.id)}
          aria-pressed={object.appearance.wireframe}
          className={cx(
            "w-10 h-5 rounded-full relative transition-colors",
            object.appearance.wireframe
              ? "bg-[var(--accent)]"
              : "bg-black/30 border border-[var(--border-subtle)]"
          )}
        >
          <span
            className={cx(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
              object.appearance.wireframe ? "left-[22px]" : "left-0.5"
            )}
          />
        </button>
      </div>
    </section>
  );
}
