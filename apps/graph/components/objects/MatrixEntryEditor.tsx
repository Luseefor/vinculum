// S28 shared matrix entry editor (PART 40/41/71): a visual 2×2/3×3
// grid (never nine vertical form rows) serving the ObjectRow expanded
// definition and the Inspector section alike. DOM order is row-major so
// Tab advances a11→a12→a21…; cells commit immediately like coordinate
// fields, with blur reconcile. Enter behavior is injected: rows must NOT
// create-next from middle cells.

"use client";

import { MathInput } from "@/components/math/MathInput";

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import type { LinearTransformObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { compileGeometryCoordinate } from "@/lib/math/compileGeometryCoordinate";
import type { LinearTransformEntryField } from "@/store/graphStoreTypes";

function entryFieldsFor(dimension: "2d" | "3d"): LinearTransformEntryField[] {
  return dimension === "2d"
    ? ["m11", "m12", "m21", "m22"]
    : ["m11", "m12", "m13", "m21", "m22", "m23", "m31", "m32", "m33"];
}

function readEntry(object: LinearTransformObject, field: LinearTransformEntryField): string {
  return (object as unknown as Record<string, string>)[field] ?? "";
}

export default function MatrixEntryEditor({
  object,
  firstCellRef,
  onEnterKey
}: {
  object: LinearTransformObject;
  firstCellRef?: Ref<HTMLInputElement>;
  onEnterKey?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const updateLinearTransformEntry = useGraphStore((state) => state.updateLinearTransformEntry);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);
  const fields = useMemo(() => entryFieldsFor(object.dimension), [object.dimension]);
  const size = object.dimension === "2d" ? 2 : 3;

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field, readEntry(object, field)]))
  );

  // Adopt committed values only on divergence (undo/redo/dimension
  // switch); keystroke commits already match, so typing never clobbers.
  // A focused cell keeps its draft until blur reconciles it.
  useEffect(() => {
    const activeLabel = document.activeElement?.getAttribute("aria-label") ?? null;
    setDrafts((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const field of fields) {
        const committed = readEntry(object, field);
        if ((next[field] ?? null) !== committed && activeLabel !== cellLabel(field)) {
          next[field] = committed;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [object, fields]);

  const diagnostics = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const field of fields) {
      const draft = drafts[field] ?? "";
      if (!draft.trim()) {
        result[field] = null;
        continue;
      }
      result[field] = compileGeometryCoordinate(draft, paramScope).error;
    }
    return result;
  }, [drafts, fields, paramScope]);

  return (
    <>
      <div
        className="inline-grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="group"
        aria-label={object.dimension === "2d" ? "2 by 2 matrix entries" : "3 by 3 matrix entries"}
      >
      {fields.map((field, index) => (
          <div
            key={field}
            className="flex min-w-0 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-1.5 py-1 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors"
          >
          <MathInput
            ref={index === 0 ? firstCellRef : undefined}
            type="text"
            value={drafts[field] ?? ""}
            aria-label={cellLabel(field)}
            aria-invalid={diagnostics[field] !== null}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDrafts((prev) => ({ ...prev, [field]: nextValue }));
              updateLinearTransformEntry(object.id, field, nextValue);
            }}
            onBlur={() => {
              const committed = readEntry(object, field);
              const draft = drafts[field] ?? "";
              if (draft !== committed) {
                updateLinearTransformEntry(object.id, field, draft);
              }
            }}
            onKeyDown={onEnterKey}
            spellCheck={false}
            autoComplete="off"
            inputMode="text"
            className="math-input-compact w-full min-w-0 bg-transparent font-mono text-[12px] text-[var(--accent-ink)] outline-none"
          />
        </div>
      ))}
      </div>
      {fields.some((field) => diagnostics[field]) && (
        <p className="mt-1 text-[10px] font-medium text-red-700 dark:text-red-300" role="alert">
          {fields.map((field) => diagnostics[field]).find(Boolean)}
        </p>
      )}
    </>
  );
}

function cellLabel(field: LinearTransformEntryField): string {
  const match = /^m([123])([123])$/.exec(field);
  if (!match) {
    return `Matrix entry ${field}`;
  }
  return `Row ${match[1]} column ${match[2]}`;
}
