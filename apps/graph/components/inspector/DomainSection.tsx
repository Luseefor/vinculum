"use client";

import { useEffect, useMemo, useState } from "react";
import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import { ui } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

type DomainField = keyof SurfaceDomain;

type DomainDraft = Record<DomainField, string>;

interface DomainSectionProps {
  object: SurfaceGraphObject;
}

const DOMAIN_FIELDS: Array<{ key: DomainField; label: string }> = [
  { key: "xMin", label: "xMin" },
  { key: "xMax", label: "xMax" },
  { key: "yMin", label: "yMin" },
  { key: "yMax", label: "yMax" }
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

    const safeResolution = Math.max(2, Math.floor(parsedValue));
    updateSurfaceResolution(object.id, safeResolution);
    setResolutionDraft(String(safeResolution));
  };

  return (
    <section className={ui.panel + " p-3"}>
      <h4 className={ui.sectionTitle}>Domain</h4>

      <div className="mt-2 grid grid-cols-2 gap-2">
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
        <label htmlFor="resolution-input" className={ui.fieldLabel}>
          Resolution
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
          className={ui.inputBase}
        />
        <p className="mt-1 text-[11px] text-slate-500">Higher values increase mesh detail and render cost.</p>
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
      <span className={ui.fieldLabel}>{label}</span>
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
        className={ui.inputBase}
      />
    </label>
  );
}
