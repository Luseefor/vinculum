"use client";

import { useEffect, useState } from "react";
import type { ParametricSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  MAX_PARAMETRIC_SURFACE_RESOLUTION,
  MIN_PARAMETRIC_SURFACE_RESOLUTION,
  normalizeParametricSurfaceResolution,
  normalizeSurfaceResolution
} from "@vinculum/scene/defaults";
import { useGraphStore } from "@/store/graphStore";

interface TessellationSectionProps {
  object: SurfaceGraphObject | ParametricSurfaceObject;
}

export default function TessellationSection({ object }: TessellationSectionProps) {
  const updateSurfaceResolution = useGraphStore((state) => state.updateSurfaceResolution);
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const [resolutionDraft, setResolutionDraft] = useState(String(object.resolution));

  useEffect(() => setResolutionDraft(String(object.resolution)), [object.resolution]);

  const isParametricSurface = object.kind === "parametricSurface";
  const rangeLabel = isParametricSurface
    ? `Resolution (${MIN_PARAMETRIC_SURFACE_RESOLUTION}-${MAX_PARAMETRIC_SURFACE_RESOLUTION})`
    : "Resolution (2-128)";

  const commitResolution = (value: number) => {
    if (isParametricSurface) {
      updateParametricSurfaceExpression(object.id, "resolution", value);
      return;
    }
    updateSurfaceResolution(object.id, value);
  };

  const stepResolution = (delta: number) => {
    const next = isParametricSurface
      ? normalizeParametricSurfaceResolution(object.resolution + delta)
      : normalizeSurfaceResolution(object.resolution + delta);
    commitResolution(next);
  };

  return (
    <section>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Tessellation</p>
      <div className="flex flex-col gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{rangeLabel}</p>
          <span className="font-mono text-[11px] font-semibold text-[var(--accent-ink)]">{object.resolution}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-transparent">
            <button
              type="button"
              onClick={() => stepResolution(-1)}
              aria-label="Decrease resolution"
              className="h-8 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeftIcon />
            </button>
            <input
              type="number"
              value={resolutionDraft}
              aria-label="Resolution"
              onChange={(e) => setResolutionDraft(e.target.value)}
              onBlur={() => commitResolution(Number(resolutionDraft))}
              className="h-8 flex-1 bg-transparent text-center font-mono text-[13px] font-semibold outline-none"
            />
            <button
              type="button"
              onClick={() => stepResolution(1)}
              aria-label="Increase resolution"
              className="h-8 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
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
