"use client";

import { useEffect, useState } from "react";
import type { ImplicitSurfaceObject, ParametricSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  MAX_IMPLICIT_SURFACE_RESOLUTION,
  MAX_PARAMETRIC_SURFACE_RESOLUTION,
  MIN_IMPLICIT_SURFACE_RESOLUTION,
  MIN_PARAMETRIC_SURFACE_RESOLUTION,
  normalizeImplicitSurfaceResolution,
  normalizeParametricSurfaceResolution,
  normalizeSurfaceResolution
} from "@vinculum/scene/defaults";
import { useGraphStore } from "@/store/graphStore";

interface TessellationSectionProps {
  object: SurfaceGraphObject | ParametricSurfaceObject | ImplicitSurfaceObject;
}

export default function TessellationSection({ object }: TessellationSectionProps) {
  const updateSurfaceResolution = useGraphStore((state) => state.updateSurfaceResolution);
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);
  const [resolutionDraft, setResolutionDraft] = useState(String(object.resolution));

  useEffect(() => setResolutionDraft(String(object.resolution)), [object.resolution]);

  const isParametricSurface = object.kind === "parametricSurface";
  const isImplicitSurface = object.kind === "implicitSurface";
  const rangeLabel = isImplicitSurface
    ? `Resolution (${MIN_IMPLICIT_SURFACE_RESOLUTION}-${MAX_IMPLICIT_SURFACE_RESOLUTION})`
    : isParametricSurface
      ? `Resolution (${MIN_PARAMETRIC_SURFACE_RESOLUTION}-${MAX_PARAMETRIC_SURFACE_RESOLUTION})`
      : "Resolution (2-128)";

  const commitResolution = (value: number) => {
    if (isImplicitSurface) {
      updateImplicitSurfaceExpression(object.id, "resolution", value);
      return;
    }
    if (isParametricSurface) {
      updateParametricSurfaceExpression(object.id, "resolution", value);
      return;
    }
    updateSurfaceResolution(object.id, value);
  };

  const stepResolution = (delta: number) => {
    const next = isImplicitSurface
      ? normalizeImplicitSurfaceResolution(object.resolution + delta)
      : isParametricSurface
        ? normalizeParametricSurfaceResolution(object.resolution + delta)
        : normalizeSurfaceResolution(object.resolution + delta);
    commitResolution(next);
  };

  return (
    <section>
      <h3 className="mb-2 text-[13px] font-semibold text-[var(--text-primary)]">Mesh quality</h3>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{rangeLabel}</p>
          <span className="font-mono text-[11px] font-semibold text-[var(--accent-ink)]">{object.resolution}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-[var(--radius-sm)] bg-[var(--editor-control)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <button
              type="button"
              onClick={() => stepResolution(-1)}
              aria-label="Decrease resolution"
              className="h-9 shrink-0 px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeftIcon />
            </button>
            <input
              type="number"
              value={resolutionDraft}
              aria-label="Resolution"
              onChange={(e) => setResolutionDraft(e.target.value)}
              onBlur={() => commitResolution(Number(resolutionDraft))}
              className="h-9 w-full min-w-0 flex-1 bg-transparent text-center font-mono text-[13px] font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => stepResolution(1)}
              aria-label="Increase resolution"
              className="h-9 shrink-0 px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9.5 3.5L5.5 8l4 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6.5 3.5L10.5 8l-4 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
