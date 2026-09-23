"use client";

import { useEffect, useState } from "react";
import type { VectorFieldObject } from "@vinculum/scene/types";
import {
  MAX_VECTOR_FIELD_SCALE,
  MIN_VECTOR_FIELD_SCALE,
  normalizeVectorFieldScale
} from "@vinculum/scene/defaults";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";

interface VectorFieldAppearanceSectionProps {
  object: VectorFieldObject;
}

// S20 PART 13: one color per field, a bounded arrow-scale control, and a
// normalize toggle. All three are render-only: changing them recomputes
// glyph instances on the main thread with zero worker jobs (PART 24).
export default function VectorFieldAppearanceSection({ object }: VectorFieldAppearanceSectionProps) {
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const updateVectorFieldExpression = useGraphStore((state) => state.updateVectorFieldExpression);
  const [scaleDraft, setScaleDraft] = useState(String(object.scale));

  useEffect(() => setScaleDraft(String(object.scale)), [object.scale]);

  const commitScale = (value: number) => {
    if (Number.isFinite(value)) {
      updateVectorFieldExpression(object.id, "scale", value);
    }
  };

  const commitScaleDraft = () => {
    // S20-R10: empty/non-numeric drafts revert instead of clamping to the
    // minimum (Number("") is 0, which would silently rewrite the scale).
    if (scaleDraft.trim() === "") {
      setScaleDraft(String(object.scale));
      return;
    }
    const value = Number(scaleDraft);
    if (!Number.isFinite(value)) {
      setScaleDraft(String(object.scale));
      return;
    }
    commitScale(value);
  };

  const stepScale = (delta: number) => {
    const rounded = Math.round((object.scale + delta) * 10) / 10;
    commitScale(normalizeVectorFieldScale(rounded));
  };

  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Appearance</h4>

      <div className="flex flex-col gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
        <div className="flex items-center gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
          <input
            type="color"
            aria-label="Field color"
            value={object.color}
            onChange={(event) => updateObjectColor(object.id, event.target.value)}
            className="h-8 w-8 cursor-pointer rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] p-0.5"
          />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Color</p>
            <p className="font-mono text-[11px] text-[var(--text-tertiary)]">{object.color}</p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Arrow scale ({MIN_VECTOR_FIELD_SCALE}-{MAX_VECTOR_FIELD_SCALE})
            </p>
            <span className="font-mono text-[11px] font-semibold text-[var(--accent-ink)]">{object.scale}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-transparent">
              <button
                type="button"
                onClick={() => stepScale(-0.1)}
                aria-label="Decrease arrow scale"
                className="h-8 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              >
                <ChevronLeftIcon />
              </button>
              <input
                type="number"
                value={scaleDraft}
                min={MIN_VECTOR_FIELD_SCALE}
                max={MAX_VECTOR_FIELD_SCALE}
                step={0.1}
                aria-label="Arrow scale"
                onChange={(e) => setScaleDraft(e.target.value)}
                onBlur={commitScaleDraft}
                className="h-8 w-full bg-transparent px-2 text-center text-[13px] text-[var(--text-primary)] outline-none"
              />
              <button
                type="button"
                onClick={() => stepScale(0.1)}
                aria-label="Increase arrow scale"
                className="h-8 px-2 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">
            Render-only: resizes glyphs without resampling the field.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Normalize vectors</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              {object.normalize
                ? "On: all nonzero arrows share one length"
                : "Off: length represents relative magnitude"}
            </p>
          </div>
          <Switch
            checked={object.normalize}
            onCheckedChange={(checked) => updateVectorFieldExpression(object.id, "normalize", checked)}
            ariaLabel={object.normalize ? "Disable vector normalization" : "Enable vector normalization"}
          />
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
