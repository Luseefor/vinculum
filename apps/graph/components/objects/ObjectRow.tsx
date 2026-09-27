"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GraphObject, GraphObjectKind, LinearTransformDimension, VectorFieldDimension } from "@vinculum/scene/types";
import { EyeIcon, EyeOffIcon, MoreHorizontalIcon, ChevronDownIcon } from "@/components/layout/icons";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import {
  getImplicitSurfaceEquationDiagnostics,
  getParametricAxisDiagnostics,
  getParametricSurfaceAxisDiagnostics,
  getPlaneEquationDiagnostics,
  getSurfaceEquationDiagnostics,
  getVectorFieldComponentDiagnostics,
  type ExpressionDiagnostic
} from "@/lib/math/expressionDiagnostics";
import { ObjectRowContextMenu } from "./ObjectRowContextMenu";
import GeometryCoordinateFields from "./GeometryCoordinateFields";
import MatrixEntryEditor from "./MatrixEntryEditor";
import { getObjectRowDisplayMeta, isExpressionRowEmpty } from "./objectRowUtils";
import { useGeometryComputeStore, type GeometryComputeStatus } from "@/lib/compute/geometryComputeStatus";
import { isDragTransactionActive } from "@/lib/interaction/dragHistoryTransaction";

interface ObjectRowProps {
  object: GraphObject;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

export default function ObjectRow({ object, index, selected, onSelect, onToggleVisibility }: ObjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ellipsisRef = useRef<HTMLButtonElement>(null);

  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);
  const updateVectorFieldExpression = useGraphStore((state) => state.updateVectorFieldExpression);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const removeObject = useGraphStore((state) => state.removeObject);
  const insertObjectAfter = useGraphStore((state) => state.insertObjectAfter);
  const focusEquationForObjectId = useGraphStore((state) => state.ui.focusEquationForObjectId);
  const requestEquationFocus = useGraphStore((state) => state.requestEquationFocus);
  const clearEquationFocus = useGraphStore((state) => state.clearEquationFocus);
  // S19: subtle transient compute status (pending/error only, never announced
  // live). Subscribes to this row's entry alone so other rows never rerender.
  const computeStatus = useGeometryComputeStore(
    (state): GeometryComputeStatus => state.entries[object.id]?.status ?? "idle"
  );
  const eqInputRef = useRef<HTMLInputElement>(null);
  const xExprInputRef = useRef<HTMLInputElement>(null);
  const pExprInputRef = useRef<HTMLInputElement>(null);
  const primitiveFirstInputRef = useRef<HTMLInputElement>(null);
  const matrixFirstCellRef = useRef<HTMLInputElement>(null);

  const [localEq, setLocalEq] = useState("");
  const [localX, setLocalX] = useState("");
  const [localY, setLocalY] = useState("");
  const [localZ, setLocalZ] = useState("");
  const [localP, setLocalP] = useState("");
  const [localQ, setLocalQ] = useState("");
  const [localR, setLocalR] = useState("");

  useEffect(() => {
    if (object.kind === "surface" || object.kind === "plane" || object.kind === "implicitSurface") {
      setLocalEq(object.equation);
    }
    if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
      setLocalX(object.xExpr);
      setLocalY(object.yExpr);
      setLocalZ(object.zExpr);
    }
    if (object.kind === "vectorField") {
      setLocalP(object.pExpr);
      setLocalQ(object.qExpr);
      setLocalR(object.rExpr);
    }
  }, [object]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPos(null);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) {
        return;
      }
      if (ellipsisRef.current?.contains(t)) {
        return;
      }
      closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen, closeMenu]);

  const meta = getObjectRowDisplayMeta(object);
  const title = `${meta.label} #${index + 1}`;
  const emptyCue = isExpressionRowEmpty(object);
  const equationSnippet = useMemo(() => {
    if (object.kind !== "surface" && object.kind !== "plane" && object.kind !== "implicitSurface") {
      return null;
    }
    const compact = object.equation.replace(/\s+/g, " ").trim();
    if (!compact) {
      return null;
    }
    return compact.length > 30 ? `${compact.slice(0, 29)}…` : compact;
  }, [object]);
  const subLabel = emptyCue
    ? meta.type
    : (equationSnippet ?? meta.type);

  // Inline definition diagnostics (display only; commits stay immediate).
  // Errors appear only for non-empty drafts so fresh rows stay quiet.
  const definitionDiagnostic: ExpressionDiagnostic | null = useMemo(() => {
    if (object.kind === "surface") {
      if (!localEq.trim()) {
        return null;
      }
      const diag = getSurfaceEquationDiagnostics(localEq, object.orientation || "z");
      return diag.status === "error" ? diag : null;
    }
    if (object.kind === "plane") {
      if (!localEq.trim()) {
        return null;
      }
      const diag = getPlaneEquationDiagnostics(localEq);
      return diag.status === "error" ? diag : null;
    }
    if (object.kind === "implicitSurface") {
      if (!localEq.trim()) {
        return null;
      }
      const diag = getImplicitSurfaceEquationDiagnostics(localEq);
      return diag.status === "error" ? diag : null;
    }
    if (object.kind === "vectorField") {
      const fields = [
        { field: "pExpr" as const, value: localP },
        { field: "qExpr" as const, value: localQ },
        ...(object.dimension === "3d" ? [{ field: "rExpr" as const, value: localR }] : [])
      ];
      for (const entry of fields) {
        if (!entry.value.trim()) {
          continue;
        }
        const diag = getVectorFieldComponentDiagnostics({
          field: entry.field,
          dimension: object.dimension,
          pExpr: localP,
          qExpr: localQ,
          rExpr: localR
        });
        if (diag.status === "error") {
          return { ...diag, fieldContext: entry.field };
        }
      }
      return null;
    }
    const fields = [
      { field: "xExpr" as const, value: localX },
      { field: "yExpr" as const, value: localY },
      { field: "zExpr" as const, value: localZ }
    ];
    const getAxisDiagnostics =
      object.kind === "parametricSurface" ? getParametricSurfaceAxisDiagnostics : getParametricAxisDiagnostics;
    for (const entry of fields) {
      if (!entry.value.trim()) {
        continue;
      }
      const diag = getAxisDiagnostics({ field: entry.field, xExpr: localX, yExpr: localY, zExpr: localZ });
      if (diag.status === "error") {
        return { ...diag, fieldContext: entry.field };
      }
    }
    return null;
  }, [object, localEq, localX, localY, localZ, localP, localQ, localR]);

  const convertKind = (kind: GraphObjectKind, dimension?: VectorFieldDimension | LinearTransformDimension) => {
    setObjectKind(object.id, kind, dimension);
    onSelect(object.id);
    closeMenu();
  };

  const handleRemove = () => {
    // S33-R7: row-menu deletion mid-drag would lose its undo entry (the
    // shell suppresses all pushes while a transaction is active) — refuse
    // it like the Delete key and palette paths.
    if (isDragTransactionActive()) {
      closeMenu();
      return;
    }
    removeObject(object.id);
    closeMenu();
  };

  useEffect(() => {
    if (emptyCue) {
      setIsExpanded(true);
    }
  }, [emptyCue, object.id]);

  // Creation-focus contract: a fresh row expands and focuses its primary
  // equation input so the user can type immediately. Consumed once.
  // Sequenced across commits: expand first, then focus once the input is
  // mounted (refs attach during commit, so no rAF timing is involved).
  const wantsFocus = focusEquationForObjectId === object.id;
  useEffect(() => {
    if (wantsFocus && !isExpanded) {
      setIsExpanded(true);
    }
  }, [wantsFocus, isExpanded, object.id]);
  useEffect(() => {
    if (!wantsFocus || !isExpanded) {
      return;
    }
    const target =
      object.kind === "parametricCurve" || object.kind === "parametricSurface"
        ? xExprInputRef.current
        : object.kind === "vectorField"
          ? pExprInputRef.current
          : object.kind === "point" ||
              object.kind === "vector" ||
              object.kind === "line" ||
              object.kind === "ray" ||
              object.kind === "segment"
            ? primitiveFirstInputRef.current
            : object.kind === "linearTransform"
              ? matrixFirstCellRef.current
              : eqInputRef.current;
    if (!target) {
      return;
    }
    target.focus({ preventScroll: true });
    target.select();
    clearEquationFocus();
  }, [wantsFocus, isExpanded, object.id, object.kind, clearEquationFocus]);

  const handleCreateNext = () => {
    const nextId = insertObjectAfter(
      object.id,
      object.kind,
      object.kind === "vectorField" ? object.dimension : undefined
    );
    if (nextId) {
      requestEquationFocus(nextId);
    }
  };

  const handleEquationKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.repeat || event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      handleCreateNext();
      return;
    }
    if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  const handleMatrixCellKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // PART 41: Enter commits the cell (blur reconciles); never
    // create-next from middle cells.
    if (event.repeat || event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.currentTarget.blur();
    }
  };

  return (
    <div className="flex flex-col gap-1 font-sans">
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(object.id);
          setMenuPos({
            top: e.clientY + 2,
            left: Math.min(e.clientX, typeof window !== "undefined" ? window.innerWidth - 200 : e.clientX)
          });
          setMenuOpen(true);
        }}
        className={cn(
          "group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] px-2 py-1.5 transition-all duration-100 motion-reduce:transition-none",
          selected ? "border border-[var(--accent)]/40 bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-muted)]/60"
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
          aria-hidden="true"
          style={{ backgroundColor: object.color }}
        />

        {emptyCue ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <button
              type="button"
              onClick={() => onSelect(object.id)}
              aria-label={selected ? `Selected ${title}` : `Select ${title}`}
              aria-pressed={selected}
              data-object-row-select={object.id}
              className="block w-full cursor-pointer overflow-hidden rounded-[4px] text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.99]"
            >
              <span className="block truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</span>            </button>
            <div className="mt-0.5">
              <select
                value={
                  object.kind === "vectorField"
                    ? `vectorField:${object.dimension}`
                    : object.kind === "linearTransform"
                      ? `linearTransform:${object.dimension}`
                      : object.kind
                }
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "vectorField:2d" || next === "vectorField:3d") {
                    convertKind("vectorField", next === "vectorField:2d" ? "2d" : "3d");
                    return;
                  }
                  if (next === "linearTransform:2d" || next === "linearTransform:3d") {
                    convertKind("linearTransform", next === "linearTransform:2d" ? "2d" : "3d");
                    return;
                  }
                  convertKind(next as GraphObjectKind);
                }}
                className="h-6 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
                aria-label="Select object type"
              >
                <option value="surface">Surface</option>
                <option value="parametricCurve">Parametric Curve</option>
                <option value="parametricSurface">Parametric Surface</option>
                <option value="implicitSurface">Implicit Surface</option>
                <option value="plane">Plane</option>
                <option value="point">Point</option>
                <option value="vector">Vector</option>
                <option value="line">Infinite Line</option>
                <option value="ray">Ray</option>
                <option value="segment">Segment</option>
                <option value="linearTransform:2d">2D Linear Transformation</option>
                <option value="linearTransform:3d">3D Linear Transformation</option>
                <option value="linearTransform">Linear Transformation</option>
                <option value="vectorField:2d">2D Vector Field</option>
                <option value="vectorField:3d">3D Vector Field</option>
              </select>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(object.id)}
            aria-label={selected ? `Selected ${title}` : `Select ${title}`}
            aria-pressed={selected}
            data-object-row-select={object.id}
            className="flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-[4px] text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 truncate text-[12px] font-semibold tracking-tight",
                  selected ? "text-[var(--accent-ink)]" : "text-[var(--text-primary)]"
                )}
              >
                <span className="min-w-0 truncate">{title}</span>
                {computeStatus !== "idle" && (
                  <span
                    role="img"
                    aria-label={
                      computeStatus === "pending" ? "Computing geometry" : "Geometry compute failed"
                    }
                    title={
                      computeStatus === "pending" ? "Computing geometry…" : "Geometry compute failed"
                    }
                    data-testid={`compute-status-${computeStatus}`}
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      computeStatus === "pending"
                        ? "animate-pulse bg-[var(--accent)] motion-reduce:animate-none"
                        : "bg-red-500/80"
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  "block truncate font-mono text-[10px] font-medium tracking-tight",
                  selected ? "text-[var(--accent-ink)]" : "text-[var(--text-tertiary)]"
                )}
                title={object.kind === "surface" || object.kind === "plane" ? object.equation : meta.type}
              >
                {subLabel}
              </span>
            </div>
          </button>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(object.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleVisibility(object.id);
              }
            }}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-transparent text-[var(--text-tertiary)] transition-all duration-100 motion-reduce:transition-none hover:border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] active:scale-[0.98]"
            aria-label={object.visible ? "Hide object" : "Show object"}
            aria-pressed={object.visible}
            title={object.visible ? "Hide object" : "Show object"}
          >
            {object.visible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? "Collapse definition" : "Expand definition"}
            aria-expanded={isExpanded}
            title={isExpanded ? "Collapse definition" : "Expand definition"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-[6px] border border-transparent text-[var(--text-tertiary)] transition-all duration-100 motion-reduce:transition-none hover:border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
              isExpanded && "rotate-180"
            )}
          >
            <ChevronDownIcon className="h-3 w-3" />
          </button>

          <button
            ref={ellipsisRef}
            type="button"
            aria-label="Object actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Object actions"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(object.id);
              if (menuOpen) {
                closeMenu();
              } else {
                const el = ellipsisRef.current;
                if (el) {
                  const r = el.getBoundingClientRect();
                  setMenuPos({
                    top: r.bottom + 4,
                    left: Math.min(r.left, window.innerWidth - 200)
                  });
                }
                setMenuOpen(true);
              }
            }}
            className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-transparent text-[var(--text-tertiary)] transition-all duration-100 motion-reduce:transition-none hover:border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] active:scale-[0.98]"
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ObjectRowContextMenu
        object={object}
        menuOpen={menuOpen}
        menuPos={menuPos}
        menuRef={menuRef}
        onConvertKind={convertKind}
        onRemove={handleRemove}
      />

      {(isExpanded || emptyCue) && (
        <div className="mx-2 mb-2 border-l border-[var(--border-subtle)] pl-2.5 pt-1 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Mathematical Definition
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {(object.kind === "surface" || object.kind === "plane" || object.kind === "implicitSurface") && (
              <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors">
                <input
                  ref={eqInputRef}
                  type="text"
                  value={localEq}
                  aria-label="Equation"
                  aria-invalid={definitionDiagnostic !== null}
                  aria-describedby={definitionDiagnostic ? `obj-${object.id}-diagnostic` : undefined}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLocalEq(next);
                    if (object.kind === "surface") updateSurfaceEquation(object.id, next);
                    else if (object.kind === "implicitSurface") updateImplicitSurfaceExpression(object.id, "equation", next);
                    else updatePlaneEquation(object.id, next);
                  }}
                  onBlur={() => {
                    if (object.kind === "surface" && localEq !== object.equation) {
                      updateSurfaceEquation(object.id, localEq);
                    } else if (object.kind === "implicitSurface" && localEq !== object.equation) {
                      updateImplicitSurfaceExpression(object.id, "equation", localEq);
                    } else if (object.kind === "plane" && localEq !== object.equation) {
                      updatePlaneEquation(object.id, localEq);
                    }
                  }}
                  onKeyDown={handleEquationKeyDown}
                  placeholder={object.kind === "surface" ? "x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1" : object.kind === "implicitSurface" ? "x^2 + y^2 + z^2 = 1" : "ax + by + cz + d = 0"}
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                />
              </div>
            )}

            {(object.kind === "parametricCurve" || object.kind === "parametricSurface") && (
              <div className="flex flex-col gap-1.5">
                {[
                  { label: object.kind === "parametricSurface" ? "x(u,v) =" : "x(t) =", val: localX, set: setLocalX, field: "xExpr" as const },
                  { label: object.kind === "parametricSurface" ? "y(u,v) =" : "y(t) =", val: localY, set: setLocalY, field: "yExpr" as const },
                  { label: object.kind === "parametricSurface" ? "z(u,v) =" : "z(t) =", val: localZ, set: setLocalZ, field: "zExpr" as const }
                ].map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors"
                  >
                    <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0 w-10">
                      {item.label}
                    </span>
                    <input
                      ref={item.field === "xExpr" ? xExprInputRef : undefined}
                      type="text"
                      value={item.val}
                      aria-label={`Parametric ${item.label}`}
                      aria-invalid={definitionDiagnostic?.fieldContext === item.field}
                      aria-describedby={definitionDiagnostic?.fieldContext === item.field ? `obj-${object.id}-diagnostic` : undefined}
                      onChange={(e) => {
                        const next = e.target.value;
                        item.set(next);
                        if (object.kind === "parametricSurface") {
                          updateParametricSurfaceExpression(object.id, item.field, next);
                        } else {
                          updateParametricExpression(object.id, item.field, next);
                        }
                      }}
                      onBlur={() => {
                        const committed =
                          item.field === "xExpr" ? object.xExpr : item.field === "yExpr" ? object.yExpr : object.zExpr;
                        if (item.val !== committed) {
                          if (object.kind === "parametricSurface") {
                            updateParametricSurfaceExpression(object.id, item.field, item.val);
                          } else {
                            updateParametricExpression(object.id, item.field, item.val);
                          }
                        }
                      }}
                      onKeyDown={handleEquationKeyDown}
                      placeholder={
                        object.kind === "parametricSurface"
                          ? item.field === "xExpr"
                            ? "u"
                            : item.field === "yExpr"
                              ? "v"
                              : "u * v"
                          : item.field === "xExpr"
                            ? "0"
                            : item.field === "yExpr"
                              ? "cos(t)"
                              : "sin(t)"
                      }
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
            {object.kind === "vectorField" && (
              <div className="flex flex-col gap-1.5">
                {[
                  {
                    label: object.dimension === "3d" ? "P(x,y,z) =" : "P(x,y) =",
                    val: localP,
                    set: setLocalP,
                    field: "pExpr" as const,
                    component: "P component",
                    placeholder: "x"
                  },
                  {
                    label: object.dimension === "3d" ? "Q(x,y,z) =" : "Q(x,y) =",
                    val: localQ,
                    set: setLocalQ,
                    field: "qExpr" as const,
                    component: "Q component",
                    placeholder: "y"
                  },
                  ...(object.dimension === "3d"
                    ? [
                        {
                          label: "R(x,y,z) =",
                          val: localR,
                          set: setLocalR,
                          field: "rExpr" as const,
                          component: "R component",
                          placeholder: "z"
                        }
                      ]
                    : [])
                ].map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors"
                  >
                    <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0 w-14">
                      {item.label}
                    </span>
                    <input
                      ref={item.field === "pExpr" ? pExprInputRef : undefined}
                      type="text"
                      value={item.val}
                      aria-label={`Vector field ${item.component}`}
                      aria-invalid={definitionDiagnostic?.fieldContext === item.field}
                      aria-describedby={definitionDiagnostic?.fieldContext === item.field ? `obj-${object.id}-diagnostic` : undefined}
                      onChange={(e) => {
                        const next = e.target.value;
                        item.set(next);
                        updateVectorFieldExpression(object.id, item.field, next);
                      }}
                      onBlur={() => {
                        const committed =
                          item.field === "pExpr" ? object.pExpr : item.field === "qExpr" ? object.qExpr : object.rExpr;
                        if (item.val !== committed) {
                          updateVectorFieldExpression(object.id, item.field, item.val);
                        }
                      }}
                      onKeyDown={handleEquationKeyDown}
                      placeholder={item.placeholder}
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
            {(object.kind === "point" ||
              object.kind === "vector" ||
              object.kind === "line" ||
              object.kind === "ray" ||
              object.kind === "segment") && (
              <GeometryCoordinateFields
                object={object}
                firstInputRef={primitiveFirstInputRef}
                onEnterKey={handleEquationKeyDown}
              />
            )}
            {object.kind === "linearTransform" && (
              <MatrixEntryEditor
                object={object}
                firstCellRef={matrixFirstCellRef}
                onEnterKey={handleMatrixCellKeyDown}
              />
            )}
            {definitionDiagnostic ? (
              <p
                id={`obj-${object.id}-diagnostic`}
                data-testid="expression-diagnostic"
                role="alert"
                className="rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-700 dark:text-amber-300"
              >
                {definitionDiagnostic.message}
                {definitionDiagnostic.suggestion ? ` ${definitionDiagnostic.suggestion}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
