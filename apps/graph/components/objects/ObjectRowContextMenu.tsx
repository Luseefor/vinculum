"use client";

import type { LegacyRef } from "react";
import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";
import { cn } from "@/components/ui/styles";
import { Portal } from "@/components/ui/portal";

const CONVERT_OPTIONS = [
  { kind: "surface" as const, label: "Surface" },
  { kind: "parametricCurve" as const, label: "Parametric curve" },
  { kind: "plane" as const, label: "Plane" }
] as const;

type ObjectRowContextMenuProps = {
  object: GraphObject;
  menuOpen: boolean;
  menuPos: { top: number; left: number } | null;
  menuRef: LegacyRef<HTMLDivElement>;
  onConvertKind: (kind: GraphObjectKind) => void;
  onRemove: () => void;
};

export function ObjectRowContextMenu({
  object,
  menuOpen,
  menuPos,
  menuRef,
  onConvertKind,
  onRemove
}: ObjectRowContextMenuProps) {
  if (!menuOpen || !menuPos) {
    return null;
  }

  return (
    <Portal>
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[500] min-w-[11rem] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] py-1 shadow-lg"
        style={{ top: menuPos.top, left: menuPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Convert to</p>
        {CONVERT_OPTIONS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            disabled={object.kind === kind}
            onClick={() => onConvertKind(kind)}
            className={cn(
              "flex w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
              object.kind === kind && "cursor-not-allowed opacity-40 hover:bg-transparent"
            )}
          >
            {label}
          </button>
        ))}
        <div className="my-1 h-px bg-[var(--border-subtle)]" />
        <button
          type="button"
          role="menuitem"
          onClick={onRemove}
          className="flex w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          Remove
        </button>
      </div>
    </Portal>
  );
}
