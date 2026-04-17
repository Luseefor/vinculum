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
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        Appearance
      </h4>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2.5">
        <input
          type="color"
          aria-label="Surface color"
          value={object.color}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="color-swatch h-7 w-7"
        />
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[var(--text-primary)]">Color</p>
          <p className="truncate font-mono text-[10px] text-[var(--text-tertiary)]">{object.color}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-3 py-2.5">
        <p className="text-[12px] font-medium text-[var(--text-primary)]">Wireframe</p>
        <button
          type="button"
          onClick={() => toggleSurfaceWireframe(object.id)}
          aria-pressed={object.appearance.wireframe}
           className={cx(
              "relative h-5 w-10 rounded-full transition-colors",
              object.appearance.wireframe
                ? "bg-[var(--accent)]"
                : "bg-[color-mix(in_srgb,var(--surface-muted)_80%,var(--border-subtle)_20%)]"
            )}
        >
          <span
            className={cx(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
              object.appearance.wireframe ? "left-[20px]" : "left-0.5"
            )}
          />
        </button>
      </div>
    </section>
  );
}
