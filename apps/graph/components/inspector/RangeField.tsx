"use client";

import NumericField from "@/components/inspector/NumericField";

interface RangeFieldProps {
  label: string;
  min: number | string;
  max: number | string;
  onMinChange: (next: string) => void;
  onMaxChange: (next: string) => void;
}

export default function RangeField({ label, min, max, onMinChange, onMaxChange }: RangeFieldProps) {
  return (
    <section className="rounded-md border border-[var(--border-subtle)] p-2">
      <h4 className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</h4>
      <div className="grid grid-cols-2 gap-2">
        <NumericField label="Min" value={min} onChange={onMinChange} />
        <NumericField label="Max" value={max} onChange={onMaxChange} />
      </div>
    </section>
  );
}
