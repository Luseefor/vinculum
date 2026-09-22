"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";
import { EyeIcon, EyeOffIcon, MoreHorizontalIcon, ChevronDownIcon } from "@/components/layout/icons";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import {
  getParametricAxisDiagnostics,
  getPlaneEquationDiagnostics,
  getSurfaceEquationDiagnostics,
  type ExpressionDiagnostic
} from "@/lib/math/expressionDiagnostics";
import { ObjectRowContextMenu } from "./ObjectRowContextMenu";
import { getObjectRowDisplayMeta, isExpressionRowEmpty } from "./objectRowUtils";

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
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const removeObject = useGraphStore((state) => state.removeObject);

  const [localEq, setLocalEq] = useState("");
  const [localX, setLocalX] = useState("");
  const [localY, setLocalY] = useState("");
  const [localZ, setLocalZ] = useState("");

  useEffect(() => {
    if (object.kind === "surface" || object.kind === "plane") setLocalEq(object.equation);
    if (object.kind === "parametricCurve") {
      setLocalX(object.xExpr);
      setLocalY(object.yExpr);
      setLocalZ(object.zExpr);
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
    if (object.kind !== "surface" && object.kind !== "plane") {
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
    const fields = [
      { field: "xExpr" as const, value: localX },
      { field: "yExpr" as const, value: localY },
      { field: "zExpr" as const, value: localZ }
    ];
    for (const entry of fields) {
      if (!entry.value.trim()) {
        continue;
      }
      const diag = getParametricAxisDiagnostics({ field: entry.field, xExpr: localX, yExpr: localY, zExpr: localZ });
      if (diag.status === "error") {
        return { ...diag, fieldContext: entry.field };
      }
    }
    return null;
  }, [object, localEq, localX, localY, localZ]);

  const convertKind = (kind: GraphObjectKind) => {
    setObjectKind(object.id, kind);
    onSelect(object.id);
    closeMenu();
  };

  const handleRemove = () => {
    removeObject(object.id);
    closeMenu();
  };

  useEffect(() => {
    if (emptyCue) {
      setIsExpanded(true);
    }
  }, [emptyCue, object.id]);

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
              className="block w-full cursor-pointer overflow-hidden rounded-[4px] text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.99]"
            >
              <span className="block truncate text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</span>            </button>
            <div className="mt-0.5">
              <select
                value={object.kind}
                onChange={(e) => {
                  convertKind(e.target.value as GraphObjectKind);
                }}
                className="h-6 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
                aria-label="Select object type"
              >
                <option value="surface">Surface</option>
                <option value="parametricCurve">Curve</option>
                <option value="plane">Plane</option>
              </select>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(object.id)}
            aria-label={selected ? `Selected ${title}` : `Select ${title}`}
            aria-pressed={selected}
            className="flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-[4px] text-left outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1 overflow-hidden">
              <span
                className={cn(
                  "block truncate text-[12px] font-semibold tracking-tight",
                  selected ? "text-[var(--accent-ink)]" : "text-[var(--text-primary)]"
                )}
              >
                {title}
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
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
              Mathematical Definition
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {(object.kind === "surface" || object.kind === "plane") && (
              <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors">
                <input
                  type="text"
                  value={localEq}
                  aria-label="Equation"
                  aria-invalid={definitionDiagnostic !== null}
                  aria-describedby={definitionDiagnostic ? `obj-${object.id}-diagnostic` : undefined}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLocalEq(next);
                    if (object.kind === "surface") updateSurfaceEquation(object.id, next);
                    else updatePlaneEquation(object.id, next);
                  }}
                  onBlur={() => {
                    if (object.kind === "surface") updateSurfaceEquation(object.id, localEq);
                    else updatePlaneEquation(object.id, localEq);
                  }}
                  placeholder={object.kind === "surface" ? "x + y = 1, z = x^2 + y^2, or x^2 + y^2 = 1" : "ax + by + cz + d = 0"}
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                />
              </div>
            )}

            {object.kind === "parametricCurve" && (
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "x(t) =", val: localX, set: setLocalX, field: "xExpr" as const },
                  { label: "y(t) =", val: localY, set: setLocalY, field: "yExpr" as const },
                  { label: "z(t) =", val: localZ, set: setLocalZ, field: "zExpr" as const }
                ].map((item) => (
                  <div
                    key={item.field}
                    className="flex items-center gap-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 focus-within:ring-1 focus-within:ring-[var(--accent)] transition-colors"
                  >
                    <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0 w-10">
                      {item.label}
                    </span>
                    <input
                      type="text"
                      value={item.val}
                      aria-label={`Parametric ${item.label}`}
                      aria-invalid={definitionDiagnostic?.fieldContext === item.field}
                      aria-describedby={definitionDiagnostic?.fieldContext === item.field ? `obj-${object.id}-diagnostic` : undefined}
                      onChange={(e) => {
                        const next = e.target.value;
                        item.set(next);
                        updateParametricExpression(object.id, item.field, next);
                      }}
                      onBlur={() => updateParametricExpression(object.id, item.field, item.val)}
                      placeholder={
                        item.field === "xExpr" ? "0" : item.field === "yExpr" ? "cos(t)" : "sin(t)"
                      }
                      spellCheck={false}
                      autoComplete="off"
                      className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent-ink)] outline-none"
                    />
                  </div>
                ))}
              </div>
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
