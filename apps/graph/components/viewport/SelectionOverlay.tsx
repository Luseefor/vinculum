"use client";

interface SelectionOverlayProps {
  label: string;
}

export default function SelectionOverlay({ label }: SelectionOverlayProps) {
  return (
    <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
      {label}
    </div>
  );
}
