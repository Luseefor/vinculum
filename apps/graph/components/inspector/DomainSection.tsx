"use client";

import { useEffect, useMemo, useState } from "react";
import type { SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/styles";

type DomainField = keyof SurfaceDomain;
type DomainDraft = Record<DomainField, string>;
const DOMAIN_STEP = 0.5;

interface DomainSectionProps {
  object: SurfaceGraphObject;
}

export default function DomainSection({ object }: DomainSectionProps) {
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);

  const domainSnapshot = useMemo<DomainDraft>(
    () => ({
      xMin: String(object.domain.xMin),
      xMax: String(object.domain.xMax),
      yMin: String(object.domain.yMin),
      yMax: String(object.domain.yMax)
    }),
    [object.domain]
  );

  const [domainDraft, setDomainDraft] = useState<DomainDraft>(domainSnapshot);

  useEffect(() => setDomainDraft(domainSnapshot), [domainSnapshot]);

  const commitDomainField = (field: DomainField) => {
    const val = Number(domainDraft[field]);
    if (!Number.isFinite(val)) {
      setDomainDraft(prev => ({ ...prev, [field]: String(object.domain[field]) }));
      return;
    }
    updateSurfaceDomain(object.id, { [field]: val });
  };

  const stepDomainField = (field: DomainField, delta: number) => {
    const next = Number(domainDraft[field]) + delta;
    updateSurfaceDomain(object.id, { [field]: next });
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Domain</h4>
          <span className="text-[9px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full uppercase">Step control</span>
        </div>

        <div className="flex flex-col gap-5 p-4 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-primary)]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Bounds</p>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">X Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <RangeField label="Min" symbol="≥" value={domainDraft.xMin} onChange={v => setDomainDraft(p => ({ ...p, xMin: v }))} onBlur={() => commitDomainField("xMin")} onStepDown={() => stepDomainField("xMin", -DOMAIN_STEP)} onStepUp={() => stepDomainField("xMin", DOMAIN_STEP)} />
                  <RangeField label="Max" symbol="≤" value={domainDraft.xMax} onChange={v => setDomainDraft(p => ({ ...p, xMax: v }))} onBlur={() => commitDomainField("xMax")} onStepDown={() => stepDomainField("xMax", -DOMAIN_STEP)} onStepUp={() => stepDomainField("xMax", DOMAIN_STEP)} />
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">Y Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <RangeField label="Min" symbol="≥" value={domainDraft.yMin} onChange={v => setDomainDraft(p => ({ ...p, yMin: v }))} onBlur={() => commitDomainField("yMin")} onStepDown={() => stepDomainField("yMin", -DOMAIN_STEP)} onStepUp={() => stepDomainField("yMin", DOMAIN_STEP)} />
                  <RangeField label="Max" symbol="≤" value={domainDraft.yMax} onChange={v => setDomainDraft(p => ({ ...p, yMax: v }))} onBlur={() => commitDomainField("yMax")} onStepDown={() => stepDomainField("yMax", -DOMAIN_STEP)} onStepUp={() => stepDomainField("yMax", DOMAIN_STEP)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface RangeFieldProps {
  label: string;
  symbol: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  onStepDown: () => void;
  onStepUp: () => void;
}

function RangeField({ label, symbol, value, onChange, onBlur, onStepDown, onStepUp }: RangeFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{label}</label>
      <div className="flex flex-col gap-1 p-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-tertiary)] shadow-sm">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-primary)] h-6 w-6 flex items-center justify-center rounded border border-[var(--border-strong)]">{symbol}</span>
          <input 
            type="text" 
            value={value} 
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            className="w-full h-6 bg-transparent text-[11px] font-mono font-bold text-right outline-none"
          />
        </div>
        <div className="flex items-center justify-between gap-1 border-t border-[var(--border-subtle)] pt-1 mt-0.5">
           <button onClick={onStepDown} className="px-1.5 h-5 rounded hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)] transition-colors">
              <ChevronLeftIcon />
           </button>
           <button onClick={onStepUp} className="px-1.5 h-5 rounded hover:bg-[var(--surface-muted)] text-[var(--text-tertiary)] transition-colors">
              <ChevronRightIcon />
           </button>
        </div>
      </div>
    </div>
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
