"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";
import { EyeIcon, EyeOffIcon, MoreHorizontalIcon, ChevronDownIcon } from "@/components/layout/icons";
import { cn } from "@/components/ui/styles";
import { Portal } from "@/components/ui/portal";
import { useGraphStore } from "@/store/graphStore";

interface ObjectRowProps {
  object: GraphObject;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

function isExpressionRowEmpty(object: GraphObject): boolean {
  if (object.kind === "surface" || object.kind === "plane") {
    return !object.equation.trim();
  }
  return ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
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

  const meta = getDisplayMeta(object);
  const title = `${meta.label} #${index + 1}`;
  const emptyCue = isExpressionRowEmpty(object);
  const subLabel = emptyCue
    ? meta.type
    : object.kind === "surface"
      ? `${(object.orientation || "z").toUpperCase()}= f(...)`
      : meta.type;

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
        onClick={() => onSelect(object.id)}
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
          "group grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-lg border px-3 py-2.5 transition-all",
          selected
            ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/10 shadow-sm"
            : "border-transparent hover:bg-[var(--surface-muted)]"
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
          style={{ backgroundColor: object.color }}
        />

        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={cn(
              "truncate text-[11px] font-bold tracking-tight",
              selected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
            )}
          >
            {title}
          </p>
          {emptyCue ? (
            <div className="mt-0.5">
              <select
                value={object.kind}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  convertKind(e.target.value as GraphObjectKind);
                }}
                className="h-5 rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-1.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
                aria-label="Select object type"
              >
                <option value="surface">Surface</option>
                <option value="parametricCurve">Curve</option>
                <option value="plane">Plane</option>
              </select>
            </div>
          ) : (
            <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{subLabel}</p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(object.id);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {object.visible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-transform",
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
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {menuOpen && menuPos ? (
        <Portal>
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[500] min-w-[11rem] rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              Convert to
            </p>
            {(
              [
                { kind: "surface" as const, label: "Surface" },
                { kind: "parametricCurve" as const, label: "Parametric curve" },
                { kind: "plane" as const, label: "Plane" }
              ] as const
            ).map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                disabled={object.kind === kind}
                onClick={() => convertKind(kind)}
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
              onClick={handleRemove}
              className="flex w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
            >
              Remove
            </button>
          </div>
        </Portal>
      ) : null}

      {(isExpanded || emptyCue) && (
        <div className="mx-3 mb-2 p-3 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] animate-slide-up shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">
              Mathematical Definition
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {(object.kind === "surface" || object.kind === "plane") && (
              <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1.5 rounded border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors">
                <input
                  type="text"
                  value={localEq}
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
                  className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent)] outline-none"
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
                    className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1.5 rounded border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors"
                  >
                    <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0 w-10">
                      {item.label}
                    </span>
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => {
                        const next = e.target.value;
                        item.set(next);
                        updateParametricExpression(object.id, item.field, next);
                      }}
                      onBlur={() => updateParametricExpression(object.id, item.field, item.val)}
                      placeholder={
                        item.field === "xExpr" ? "0" : item.field === "yExpr" ? "cos(t)" : "sin(t)"
                      }
                      className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent)] outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getDisplayMeta(object: GraphObject): { label: string; type: string } {
  if (object.kind === "plane") {
    if (!object.equation.trim()) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    return { label: "Plane", type: "Plane" };
  }
  if (object.kind === "parametricCurve") {
    const allEmpty = ![object.xExpr, object.yExpr, object.zExpr].some((expr) => expr.trim());
    if (allEmpty) {
      return { label: "Expression", type: "Choose type in menu" };
    }
    const normalized = [object.xExpr, object.yExpr, object.zExpr].map((v) => v.replace(/\s+/g, ""));
    const isPoint = normalized.every((v) => v === "0" || v === "0.0");
    return isPoint ? { label: "Point", type: "Point" } : { label: "Curve", type: "Curve" };
  }
  if (!object.equation.trim()) {
    return { label: "Expression", type: "Choose type in menu" };
  }
  const equation = object.equation.replace(/\s+/g, "");
  if (equation === "sqrt(max(0,9-x^2-y^2))") return { label: "Sphere", type: "Sphere" };
  if (equation === "sqrt(max(0,4-x^2))") return { label: "Cylinder", type: "Cylinder" };
  return { label: "Surface", type: "Surface" };
}
