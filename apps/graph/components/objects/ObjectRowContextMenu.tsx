"use client";

import type { LegacyRef } from "react";
import type { GraphObject, GraphObjectKind, LinearTransformDimension, VectorFieldDimension } from "@vinculum/scene/types";
import { OBJECT_DESCRIPTORS } from "@/lib/objects/objectDescriptors";
import { cn } from "@/components/ui/styles";
import { Portal } from "@/components/ui/portal";

// S30: Convert labels render from the central descriptors (Title Case
// everywhere; previously this menu alone used sentence-case). Exported for
// unit coverage of the 14-entry Title-Case taxonomy.
export const CONVERT_OPTIONS: Array<{
  kind: GraphObjectKind;
  dimension?: VectorFieldDimension | LinearTransformDimension;
  label: string;
  value: string;
}> = OBJECT_DESCRIPTORS.map((entry) => ({
  kind: entry.kind,
  dimension: entry.dimension,
  label: entry.label,
  value: entry.dimension ? `${entry.kind}:${entry.dimension}` : entry.kind
}));

type ObjectRowContextMenuProps = {
  object: GraphObject;
  menuOpen: boolean;
  menuPos: { top: number; left: number } | null;
  menuRef: LegacyRef<HTMLDivElement>;
  onConvertKind: (kind: GraphObjectKind, dimension?: VectorFieldDimension | LinearTransformDimension) => void;
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
        {CONVERT_OPTIONS.map(({ kind, dimension, label, value }) => {
          const isCurrent =
            object.kind === kind &&
            (kind !== "vectorField" ||
              (object.kind === "vectorField" && object.dimension === dimension)) &&
            (kind !== "linearTransform" ||
              (object.kind === "linearTransform" && object.dimension === dimension));
          return (
            <button
              key={value}
              type="button"
              role="menuitem"
              disabled={isCurrent}
              onClick={() => onConvertKind(kind, dimension)}
              className={cn(
                "flex w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
                isCurrent && "cursor-not-allowed opacity-40 hover:bg-transparent"
              )}
            >
              {label}
            </button>
          );
        })}
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
