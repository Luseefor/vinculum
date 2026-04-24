"use client";

import type { GraphObject } from "@vinculum/scene/types";

interface ObjectRowProps {
  object: GraphObject;
  selected: boolean;
  onSelect: (id: string) => void;
}

export default function ObjectRow({ object, selected, onSelect }: ObjectRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(object.id)}
      className={[
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px]",
        selected ? "bg-[var(--surface-selection)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]"
      ].join(" ")}
    >
      <span className="truncate">{object.kind}</span>
      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{object.id.slice(0, 6)}</span>
    </button>
  );
}
