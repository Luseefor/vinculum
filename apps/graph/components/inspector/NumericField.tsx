"use client";

import { Input } from "@/components/ui/input";

interface NumericFieldProps {
  label: string;
  value: number | string;
  onChange: (next: string) => void;
}

export default function NumericField({ label, value, onChange }: NumericFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
      <Input value={String(value)} onChange={(event) => onChange(event.target.value)} className="h-8 font-mono text-[12px]" />
    </label>
  );
}
