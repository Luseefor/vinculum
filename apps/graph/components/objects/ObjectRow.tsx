"use client";

import type { GraphObject } from "@vinculum/scene/types";

interface ObjectRowProps {
  object: GraphObject;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

export default function ObjectRow({ object, index, selected, onSelect, onToggleVisibility }: ObjectRowProps) {
  const title = `${labelForKind(object.kind)} #${index + 1}`;

  return (
    <div
      className={[
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px]",
        selected ? "bg-[var(--surface-selection)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]"
      ].join(" ")}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: object.color }} />
      <button type="button" onClick={() => onSelect(object.id)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{object.id.slice(0, 8)}</p>
      </button>
      <span className="rounded border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {shortKind(object.kind)}
      </span>
      <button
        type="button"
        onClick={() => onToggleVisibility(object.id)}
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
        title={object.visible ? "Hide object" : "Show object"}
        aria-label={object.visible ? "Hide object" : "Show object"}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          {object.visible ? (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" />
          )}
        </svg>
      </button>
    </div>
  );
}

function labelForKind(kind: GraphObject["kind"]): string {
  if (kind === "parametricCurve") {
    return "Curve";
  }
  if (kind === "plane") {
    return "Plane";
  }
  return "Surface";
}

function shortKind(kind: GraphObject["kind"]): string {
  if (kind === "parametricCurve") {
    return "curve";
  }
  return kind;
}
