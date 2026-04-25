"use client";

import { useState, useEffect } from "react";
import type { GraphObject, SurfaceOrientation } from "@vinculum/scene/types";
import { EyeIcon, EyeOffIcon, MoreHorizontalIcon, ChevronDownIcon } from "@/components/layout/icons";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

interface ObjectRowProps {
  object: GraphObject;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

export default function ObjectRow({ object, index, selected, onSelect, onToggleVisibility }: ObjectRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceOrientation = useGraphStore((state) => state.updateSurfaceOrientation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);

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

  const meta = getDisplayMeta(object);
  const title = `${meta.label} #${index + 1}`;

  const orientations: SurfaceOrientation[] = ["z", "y", "x"];

  return (
    <div className="flex flex-col gap-1 font-sans">
      <div
        onClick={() => onSelect(object.id)}
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
          <p className={cn(
            "truncate text-[11px] font-bold tracking-tight",
            selected ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
          )}>
            {title}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {object.kind === 'surface' ? `${(object.orientation || 'z').toUpperCase()}= f(...)` : meta.type}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(object.id); }}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {object.visible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
          </button>
          
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-transform",
              isExpanded && "rotate-180"
            )}
          >
            <ChevronDownIcon className="h-3 w-3" />
          </button>

          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--surface-overlay)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mx-3 mb-2 p-3 rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] animate-slide-up shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Mathematical Definition</p>
            {object.kind === "surface" && (
              <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded-md border border-[var(--border-subtle)]">
                {orientations.map(o => (
                  <button
                    key={o}
                    onClick={() => updateSurfaceOrientation(object.id, o)}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold transition-all",
                      (object.orientation || 'z') === o 
                        ? "bg-[var(--accent)] text-white shadow-sm" 
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                    )}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {(object.kind === "surface" || object.kind === "plane") && (
              <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1.5 rounded border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors">
                <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0">
                  {object.kind === "surface" ? `${(object.orientation || 'z')} =` : "f ="}
                </span>
                <input
                  type="text"
                  value={localEq}
                  onChange={(e) => setLocalEq(e.target.value)}
                  onBlur={() => {
                    if (object.kind === "surface") updateSurfaceEquation(object.id, localEq);
                    else updatePlaneEquation(object.id, localEq);
                  }}
                  className="w-full bg-transparent font-mono text-[10px] font-bold text-[var(--accent)] outline-none"
                />
              </div>
            )}

            {object.kind === "parametricCurve" && (
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "x(t) =", val: localX, set: setLocalX, field: "xExpr" },
                  { label: "y(t) =", val: localY, set: setLocalY, field: "yExpr" },
                  { label: "z(t) =", val: localZ, set: setLocalZ, field: "zExpr" }
                ].map((item) => (
                  <div key={item.field} className="flex items-center gap-2 bg-[var(--bg-tertiary)] p-1.5 rounded border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors">
                    <span className="text-[10px] font-mono font-bold text-[var(--text-tertiary)] shrink-0 w-10">{item.label}</span>
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => item.set(e.target.value)}
                      onBlur={() => updateParametricExpression(object.id, item.field as any, item.val)}
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
  if (object.kind === "plane") return { label: "Plane", type: "Plane" };
  if (object.kind === "parametricCurve") {
    const normalized = [object.xExpr, object.yExpr, object.zExpr].map(v => v.replace(/\s+/g, ""));
    const isPoint = normalized.every(v => v === "0" || v === "0.0");
    return isPoint ? { label: "Point", type: "Point" } : { label: "Curve", type: "Curve" };
  }
  const equation = object.equation.replace(/\s+/g, "");
  if (equation === "sqrt(max(0,9-x^2-y^2))") return { label: "Sphere", type: "Sphere" };
  if (equation === "sqrt(max(0,4-x^2))") return { label: "Cylinder", type: "Cylinder" };
  return { label: "Surface", type: "Surface" };
}
