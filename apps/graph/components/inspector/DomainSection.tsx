"use client";

import { useEffect, useMemo, useState } from "react";
import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import {
  MAX_SURFACE_RESOLUTION,
  MIN_SURFACE_RESOLUTION,
  normalizeSurfaceResolution
} from "@vinculum/scene/defaults";
import { useGraphStore } from "@/store/graphStore";

type DomainField = keyof SurfaceDomain;

type DomainDraft = Record<DomainField, string>;
type DomainAxis = "x" | "y";

interface DomainSectionProps {
  object: SurfaceGraphObject;
}

const DOMAIN_FIELDS: Array<{ key: DomainField; label: string }> = [
  { key: "xMin", label: "X min" },
  { key: "xMax", label: "X max" },
  { key: "yMin", label: "Y min" },
  { key: "yMax", label: "Y max" }
];

export default function DomainSection({ object }: DomainSectionProps) {
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const updateSurfaceResolution = useGraphStore((state) => state.updateSurfaceResolution);

  const domainSnapshot = useMemo<DomainDraft>(
    () => ({
      xMin: String(object.domain.xMin),
      xMax: String(object.domain.xMax),
      yMin: String(object.domain.yMin),
      yMax: String(object.domain.yMax)
    }),
    [object.domain.xMax, object.domain.xMin, object.domain.yMax, object.domain.yMin]
  );

  const [domainDraft, setDomainDraft] = useState<DomainDraft>(domainSnapshot);
  const [resolutionDraft, setResolutionDraft] = useState(String(object.resolution));

  useEffect(() => {
    setDomainDraft(domainSnapshot);
  }, [domainSnapshot, object.id]);

  useEffect(() => {
    setResolutionDraft(String(object.resolution));
  }, [object.id, object.resolution]);

  const commitDomainField = (field: DomainField) => {
    const parsedValue = Number(domainDraft[field]);
    if (!Number.isFinite(parsedValue)) {
      setDomainDraft((previous) => ({
        ...previous,
        [field]: String(object.domain[field])
      }));
      return;
    }

    const axis = field.startsWith("x") ? "x" : "y";
    const counterpart = getCounterpartField(axis, field);
    const counterpartRaw = domainDraft[counterpart];
    const counterpartValue = Number(counterpartRaw);
    if (Number.isFinite(counterpartValue)) {
      if (field.endsWith("Min") && parsedValue >= counterpartValue) {
        setDomainDraft((previous) => ({
          ...previous,
          [field]: String(object.domain[field])
        }));
        return;
      }
      if (field.endsWith("Max") && parsedValue <= counterpartValue) {
        setDomainDraft((previous) => ({
          ...previous,
          [field]: String(object.domain[field])
        }));
        return;
      }
    }

    updateSurfaceDomain(object.id, { [field]: parsedValue } as Partial<SurfaceDomain>);
    setDomainDraft((previous) => ({
      ...previous,
      [field]: String(parsedValue)
    }));
  };

  const commitResolution = () => {
    const parsedValue = Number(resolutionDraft);
    if (!Number.isFinite(parsedValue)) {
      setResolutionDraft(String(object.resolution));
      return;
    }

    const safeResolution = normalizeSurfaceResolution(parsedValue);
    updateSurfaceResolution(object.id, safeResolution);
    setResolutionDraft(String(safeResolution));
  };

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        Domain
      </h4>

      <div className="grid grid-cols-2 gap-2">
        {DOMAIN_FIELDS.map((field) => (
          <DomainInput
            key={field.key}
            label={field.label}
            value={domainDraft[field.key]}
            onChange={(value) => setDomainDraft((previous) => ({ ...previous, [field.key]: value }))}
            onCommit={() => commitDomainField(field.key)}
            onReset={() =>
              setDomainDraft((previous) => ({
                ...previous,
                [field.key]: String(object.domain[field.key])
              }))
            }
          />
        ))}
      </div>

      <div className="mt-3">
        <label
          htmlFor="resolution-input"
          className="mb-1.5 block text-[10px] font-medium text-[var(--text-secondary)]"
        >
          Resolution ({MIN_SURFACE_RESOLUTION}-{MAX_SURFACE_RESOLUTION})
        </label>
        <input
          id="resolution-input"
          value={resolutionDraft}
          onChange={(event) => setResolutionDraft(event.target.value)}
          onBlur={commitResolution}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitResolution();
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              event.preventDefault();
              setResolutionDraft(String(object.resolution));
              event.currentTarget.blur();
            }
          }}
          inputMode="numeric"
          min={MIN_SURFACE_RESOLUTION}
          max={MAX_SURFACE_RESOLUTION}
          className="input h-9 rounded-lg border-[var(--border-strong)] bg-[var(--surface-inset)] px-3 text-[12px]"
        />
      </div>
    </section>
  );
}

interface DomainInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onReset: () => void;
}

function DomainInput({ label, value, onChange, onCommit, onReset }: DomainInputProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            onReset();
            event.currentTarget.blur();
          }
        }}
        inputMode="decimal"
        className="input h-9 rounded-lg border-[var(--border-strong)] bg-[var(--surface-inset)] px-3 text-[12px]"
      />
    </label>
  );
}

function getCounterpartField(axis: DomainAxis, field: DomainField): DomainField {
  if (axis === "x") {
    return field === "xMin" ? "xMax" : "xMin";
  }
  return field === "yMin" ? "yMax" : "yMin";
}
