"use client";

import { Input } from "@/components/ui/input";

interface EquationEditorProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
}

export default function EquationEditor({ value, onChange, label = "Equation" }: EquationEditorProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 font-mono text-[12px]"
        spellCheck={false}
      />
    </label>
  );
}
