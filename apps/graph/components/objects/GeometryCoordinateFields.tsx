// S26 shared coordinate editor for geometric primitives (PART 25/27).
// S27: canonical points share the same component.
// One component serves the ObjectRow expanded definition and the
// Inspector section: compact tuple-grouped fields, immediate commits
// (ObjectRow convention), per-field diagnostics, and a single
// mathematical status line (zero-vector / nonzero-direction /
// point-degenerate). No giant vertical cards: two groups of three
// (points: one group of three).

"use client";

import { MathInput } from "@/components/math/MathInput";

import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import type { LineObject, PointObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope, parametersToScope } from "@/lib/store/editorParameters";
import { compileGeometryCoordinate } from "@/lib/math/compileGeometryCoordinate";
import {
  resolveLineGeometry,
  resolvePointGeometry,
  resolveRayGeometry,
  resolveSegmentGeometry,
  resolveVectorGeometry
} from "@/lib/math/geometryResolve";
import type { GeometryPrimitiveField } from "@/store/graphStoreTypes";
import { distanceVec3 } from "@/lib/math/geometryPrimitives";

type PrimitiveObject = PointObject | VectorObject | LineObject | RayObject | SegmentObject;

interface CoordinateFieldDef {
  field: GeometryPrimitiveField;
  group: string;
  coord: string;
  ariaLabel: string;
}

function fieldDefsFor(kind: PrimitiveObject["kind"]): CoordinateFieldDef[] {
  if (kind === "point") {
    return [
      { field: "xExpr", group: "Coordinates", coord: "x", ariaLabel: "Point x" },
      { field: "yExpr", group: "Coordinates", coord: "y", ariaLabel: "Point y" },
      { field: "zExpr", group: "Coordinates", coord: "z", ariaLabel: "Point z" }
    ];
  }
  if (kind === "vector") {
    return [
      { field: "oxExpr", group: "Origin", coord: "x", ariaLabel: "Vector origin x" },
      { field: "oyExpr", group: "Origin", coord: "y", ariaLabel: "Vector origin y" },
      { field: "ozExpr", group: "Origin", coord: "z", ariaLabel: "Vector origin z" },
      { field: "vxExpr", group: "Components", coord: "x", ariaLabel: "Vector component x" },
      { field: "vyExpr", group: "Components", coord: "y", ariaLabel: "Vector component y" },
      { field: "vzExpr", group: "Components", coord: "z", ariaLabel: "Vector component z" }
    ];
  }
  if (kind === "line") {
    return [
      { field: "pxExpr", group: "Point", coord: "x", ariaLabel: "Line point x" },
      { field: "pyExpr", group: "Point", coord: "y", ariaLabel: "Line point y" },
      { field: "pzExpr", group: "Point", coord: "z", ariaLabel: "Line point z" },
      { field: "dxExpr", group: "Direction", coord: "x", ariaLabel: "Line direction x" },
      { field: "dyExpr", group: "Direction", coord: "y", ariaLabel: "Line direction y" },
      { field: "dzExpr", group: "Direction", coord: "z", ariaLabel: "Line direction z" }
    ];
  }
  if (kind === "ray") {
    return [
      { field: "oxExpr", group: "Origin", coord: "x", ariaLabel: "Ray origin x" },
      { field: "oyExpr", group: "Origin", coord: "y", ariaLabel: "Ray origin y" },
      { field: "ozExpr", group: "Origin", coord: "z", ariaLabel: "Ray origin z" },
      { field: "dxExpr", group: "Direction", coord: "x", ariaLabel: "Ray direction x" },
      { field: "dyExpr", group: "Direction", coord: "y", ariaLabel: "Ray direction y" },
      { field: "dzExpr", group: "Direction", coord: "z", ariaLabel: "Ray direction z" }
    ];
  }
  return [
    { field: "axExpr", group: "Start", coord: "x", ariaLabel: "Segment start x" },
    { field: "ayExpr", group: "Start", coord: "y", ariaLabel: "Segment start y" },
    { field: "azExpr", group: "Start", coord: "z", ariaLabel: "Segment start z" },
    { field: "bxExpr", group: "End", coord: "x", ariaLabel: "Segment end x" },
    { field: "byExpr", group: "End", coord: "y", ariaLabel: "Segment end y" },
    { field: "bzExpr", group: "End", coord: "z", ariaLabel: "Segment end z" }
  ];
}

function readField(object: PrimitiveObject, field: GeometryPrimitiveField): string {
  return (object as unknown as Record<string, string>)[field] ?? "";
}

export function primitiveStatusLine(
  object: PrimitiveObject,
  params: Record<string, number> = getEditorParameterScope()
): { text: string; isError: boolean } | null {
  if (object.kind === "vector") {
    const resolved = resolveVectorGeometry(
      [object.oxExpr, object.oyExpr, object.ozExpr],
      [object.vxExpr, object.vyExpr, object.vzExpr],
      params
    );
    if (resolved.status !== "ok") {
      return { text: resolved.reason, isError: true };
    }
    return {
      text: resolved.degenerate ? "Zero vector." : `Magnitude ${formatShort(resolved.value.magnitude)}.`,
      isError: false
    };
  }
  if (object.kind === "point") {
    const resolved = resolvePointGeometry([object.xExpr, object.yExpr, object.zExpr], params);
    if (resolved.status !== "ok") {
      return { text: resolved.reason, isError: true };
    }
    return null;
  }
  if (object.kind === "line") {
    const resolved = resolveLineGeometry(
      [object.pxExpr, object.pyExpr, object.pzExpr],
      [object.dxExpr, object.dyExpr, object.dzExpr],
      params
    );
    if (resolved.status !== "ok") {
      return { text: resolved.reason, isError: true };
    }
    return null;
  }
  if (object.kind === "ray") {
    const resolved = resolveRayGeometry(
      [object.oxExpr, object.oyExpr, object.ozExpr],
      [object.dxExpr, object.dyExpr, object.dzExpr],
      params
    );
    if (resolved.status !== "ok") {
      return { text: resolved.reason, isError: true };
    }
    return null;
  }
  const resolved = resolveSegmentGeometry(
    [object.axExpr, object.ayExpr, object.azExpr],
    [object.bxExpr, object.byExpr, object.bzExpr],
    params
  );
  if (resolved.status !== "ok") {
    return { text: resolved.reason, isError: true };
  }
  if (resolved.degenerate) {
    return { text: "Coincident endpoints (point).", isError: false };
  }
  return {
    text: `Length ${formatShort(distanceVec3(resolved.value.start, resolved.value.end))}.`,
    isError: false
  };
}

function formatShort(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10000) / 10000;
  return `${rounded}`;
}

export default function GeometryCoordinateFields({
  object,
  firstInputRef,
  onEnterKey
}: {
  object: PrimitiveObject;
  firstInputRef?: Ref<HTMLInputElement>;
  onEnterKey?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}) {
  const updateGeometryCoordinate = useGraphStore((state) => state.updateGeometryCoordinate);
  // Parameter subscription: coordinate values (and the status readout)
  // follow live parameter edits without any rebuild ceremony.
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);
  const defs = useMemo(() => fieldDefsFor(object.kind), [object.kind]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(defs.map((def) => [def.field, readField(object, def.field)]))
  );

  // Adopt committed values only when they diverge from the draft (undo,
  // redo, external edits). Keystroke commits already match, so typing
  // never clobbers; rejected writes (unreachable via the kind whitelist)
  // would revert to committed instead of diverging forever.
  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const def of defs) {
        const committed = readField(object, def.field);
        if (!(def.field in next) || (next[def.field] !== committed && document.activeElement?.getAttribute("aria-label") !== def.ariaLabel)) {
          if (next[def.field] !== committed) {
            changed = true;
          }
          next[def.field] = committed;
        }
      }
      return changed ? next : prev;
    });
  }, [object, defs]);

  const diagnostics = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const def of defs) {
      const draft = drafts[def.field] ?? "";
      if (!draft.trim()) {
        result[def.field] = null;
        continue;
      }
      const compiled = compileGeometryCoordinate(draft, paramScope);
      result[def.field] = compiled.error;
    }
    return result;
  }, [drafts, defs, paramScope]);

  const status = useMemo(() => primitiveStatusLine(object, paramScope), [object, paramScope]);

  const groups = useMemo(() => {
    const names: string[] = [];
    for (const def of defs) {
      if (!names.includes(def.group)) {
        names.push(def.group);
      }
    }
    return names.map((name) => ({ name, fields: defs.filter((def) => def.group === name) }));
  }, [defs]);

  return (
    <div className="flex flex-col gap-1.5">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-1 text-[11px] font-medium text-[var(--text-secondary)]">
            {group.name}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {group.fields.map((def, index) => (
              <div
                key={def.field}
                className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-1.5 py-1 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors"
              >
                <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0">
                  {def.coord}
                </span>
                <MathInput
                  ref={group.name === groups[0]?.name && index === 0 ? firstInputRef : undefined}
                  type="text"
                  value={drafts[def.field] ?? ""}
                  aria-label={def.ariaLabel}
                  aria-invalid={diagnostics[def.field] !== null}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDrafts((prev) => ({ ...prev, [def.field]: next }));
                    updateGeometryCoordinate(object.id, def.field, next);
                  }}
                  onBlur={() => {
                    const committed = readField(object, def.field);
                    const draft = drafts[def.field] ?? "";
                    if (draft !== committed) {
                      updateGeometryCoordinate(object.id, def.field, draft);
                    }
                  }}
                  onKeyDown={onEnterKey}
                  spellCheck={false}
                  autoComplete="off"
                  className="math-input-compact w-full min-w-0 bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                />
              </div>
            ))}
          </div>
          {group.fields.some((def) => diagnostics[def.field]) && (
            <p className="mt-1 text-[10px] font-medium text-red-700 dark:text-red-300" role="alert">
              {group.fields.map((def) => diagnostics[def.field]).find(Boolean)}
            </p>
          )}
        </div>
      ))}
      {status && (
        <p
          className={`text-[10px] ${status.isError ? "font-medium text-red-700 dark:text-red-300" : "text-[var(--text-tertiary)]"}`}
          role="status"
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
