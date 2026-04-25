"use client";

import { useEffect, useState } from "react";
import type { SurfaceGraphObject } from "@vinculum/scene/types";
import { normalizeSurfaceResolution } from "@vinculum/scene/defaults";
import { useGraphStore } from "@/store/graphStore";

interface TessellationSectionProps {
  object: SurfaceGraphObject;
}

export default function TessellationSection({ object }: TessellationSectionProps) {
  const updateSurfaceResolution = useGraphStore((state) => state.updateSurfaceResolution);
  const [resolutionDraft, setResolutionDraft] = useState(String(object.resolution));

  useEffect(() => setResolutionDraft(String(object.resolution)), [object.resolution]);

  const stepResolution = (delta: number) => {
    const next = normalizeSurfaceResolution(object.resolution + delta);
    updateSurfaceResolution(object.id, next);
  };

  return (
    <section>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Tessellation</p>
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-primary)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">Resolution (2-128)</p>
          <span className="font-mono text-[10px] font-bold text-[var(--accent)]">{object.resolution}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--bg-tertiary)]">
            <button
              type="button"
              onClick={() => stepResolution(-1)}
              className="h-9 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeftIcon />
            </button>
            <input
              type="number"
              value={resolutionDraft}
              onChange={(e) => setResolutionDraft(e.target.value)}
              onBlur={() => updateSurfaceResolution(object.id, Number(resolutionDraft))}
              className="h-9 flex-1 bg-transparent text-center font-mono text-[11px] font-bold outline-none"
            />
            <button
              type="button"
              onClick={() => stepResolution(1)}
              className="h-9 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
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
