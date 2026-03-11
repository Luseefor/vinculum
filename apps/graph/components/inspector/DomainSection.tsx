"use client";

import { useEffect, useMemo, useState } from "react";
import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dial } from "@/components/ui/dial";
import { Input } from "@/components/ui/input";
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

const MIN_RESOLUTION = 8;
const MAX_RESOLUTION = 220;

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

  const commitResolutionDraft = () => {
    const parsedValue = Number(resolutionDraft);
    if (!Number.isFinite(parsedValue)) {
      setResolutionDraft(String(object.resolution));
      return;
    }

    const safeResolution = clampResolution(parsedValue);
    updateSurfaceResolution(object.id, safeResolution);
    setResolutionDraft(String(safeResolution));
  };

  return (
    <Card className="skeuo-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-[0.74rem] uppercase tracking-[0.3em] text-muted-foreground">Domain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
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

        <div className="skeuo-inset flex items-center justify-between px-3 py-2.5">
          <div className="pr-3">
            <p className="text-[0.74rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Resolution</p>
            <Input
              id="resolution-input"
              value={resolutionDraft}
              onChange={(event) => setResolutionDraft(event.target.value)}
              onBlur={commitResolutionDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitResolutionDraft();
                  event.currentTarget.blur();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setResolutionDraft(String(object.resolution));
                  event.currentTarget.blur();
                }
              }}
              inputMode="numeric"
              className="mt-2 h-10 border-border/85 bg-background/95 text-base"
            />
            <p className="mt-1 text-xs text-muted-foreground">Higher values increase mesh detail and render cost.</p>
          </div>

          <Dial
            label="Resolution"
            value={clampResolution(object.resolution)}
            min={MIN_RESOLUTION}
            max={MAX_RESOLUTION}
            step={2}
            onChange={(nextValue) => {
              const safeResolution = clampResolution(nextValue);
              updateSurfaceResolution(object.id, safeResolution);
              setResolutionDraft(String(safeResolution));
            }}
          />
        </div>
      </CardContent>
    </Card>
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
      <span className="mb-1 block text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <Input
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
        className="skeuo-inset h-10 text-base"
      />
    </label>
  );
}

function clampResolution(value: number): number {
  const safeValue = Number.isFinite(value) ? Math.floor(value) : MIN_RESOLUTION;
  return Math.min(MAX_RESOLUTION, Math.max(MIN_RESOLUTION, safeValue));
}
