"use client";

import NumericField from "@/components/inspector/NumericField";

interface VectorFieldProps {
  label: string;
  value: [number, number, number];
  onChange: (next: [number, number, number]) => void;
}

export default function VectorField({ label, value, onChange }: VectorFieldProps) {
  const update = (index: 0 | 1 | 2, next: string) => {
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const copy: [number, number, number] = [...value] as [number, number, number];
    copy[index] = parsed;
    onChange(copy);
  };

  return (
    <section className="rounded-md border border-[var(--border-subtle)] p-2">
      <h4 className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</h4>
      <div className="grid grid-cols-3 gap-2">
        <NumericField label="X" value={value[0]} onChange={(v) => update(0, v)} />
        <NumericField label="Y" value={value[1]} onChange={(v) => update(1, v)} />
        <NumericField label="Z" value={value[2]} onChange={(v) => update(2, v)} />
      </div>
    </section>
  );
}
