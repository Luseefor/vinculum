"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { MathInput } from "@/components/math/MathInput";
import { useGraphStore } from "@/store/graphStore";
import { splitSingleMathEquality } from "@/lib/math/implicitEquation";
import { isParameterName } from "@/lib/store/editorParameters";
import { useEditorStore } from "@/lib/store/editorStore";

interface Props {
  objectId?: string;
  value?: string;
  label?: string;
  onPendingObjectChange?: (id: string | null) => void;
  onEnter?: () => void;
}

/** A stable input remains focused while its inferred scene object changes kind. */
export const AutomaticEquationInput = forwardRef<HTMLInputElement, Props>(function AutomaticEquationInput({ objectId, value = "", label = "Equation", onPendingObjectChange, onEnter }, ref) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const objects = useGraphStore((state) => state.scene.objects);
  const lastCommitted = useRef(value);
  const dimension = useRef<"2d" | "3d" | null>(objectId ? objects.find((object) => object.id === objectId)?.kind === "implicitCurve" ? "2d" : "3d" : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ draft, pendingId, objectId });
  latest.current = { draft, pendingId, objectId };
  useEffect(() => {
    if (value !== lastCommitted.current) { lastCommitted.current = value; setDraft(value); setError(null); }
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (pendingId && !objects.some((object) => object.id === pendingId)) {
      if (timer.current) clearTimeout(timer.current);
      setPendingId(null); setDraft(""); setError(null); dimension.current = null;
      onPendingObjectChange?.(null);
    }
  }, [objects, pendingId, onPendingObjectChange]);

  const commit = (source: string) => {
    const id = latest.current.objectId ?? latest.current.pendingId ?? undefined;
    if (!source.trim() && !id) { setError(null); return true; }
    const equality = splitSingleMathEquality(source);
    const definingParameter = !objectId && (isParameterName(source.trim()) || Boolean(equality && isParameterName(equality.lhs)));
    const result = useGraphStore.getState().commitAutoEquation(source, definingParameter ? undefined : id);
    if (result.parameterId && !result.error) {
      if (latest.current.pendingId) useGraphStore.getState().removeObject(latest.current.pendingId);
      setPendingId(null); latest.current.pendingId = null; onPendingObjectChange?.(null);
      setError(null); lastCommitted.current = source; return true;
    }
    if (result.error || !result.id) { setError(result.error ?? "Could not plot this equation."); return false; }
    lastCommitted.current = source;
    setError(null);
    if (!objectId && result.id !== pendingId) { setPendingId(result.id); latest.current.pendingId = result.id; onPendingObjectChange?.(result.id); }
    if (source.trim() && result.dimension && dimension.current !== result.dimension) {
      dimension.current = result.dimension;
      useGraphStore.getState().setGraphMode(result.dimension);
      useEditorStore.getState().setViewportMode(result.dimension);
      if (result.dimension === "2d") useGraphStore.getState().setAxis2DPair("xy");
    }
    return true;
  };
  const finish = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!commit(latest.current.draft)) return false;
    if (!objectId) {
      if (!latest.current.draft.trim() && latest.current.pendingId) useGraphStore.getState().removeObject(latest.current.pendingId);
      setDraft(""); setPendingId(null); latest.current.pendingId = null; lastCommitted.current = ""; dimension.current = null;
      onPendingObjectChange?.(null);
    }
    return true;
  };
  return (
    <div ref={containerRef} className="min-w-0" data-auto-equation-input>
      <MathInput ref={ref} value={draft} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        placeholder="Type an equation" className="h-10 w-full text-[14px]"
        onChange={(event) => {
          const next = event.target.value; setDraft(next); latest.current.draft = next;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => { timer.current = null; commit(latest.current.draft); }, 350);
        }}
        onBlur={(event) => { if (!containerRef.current?.contains(event.relatedTarget as Node | null)) finish(); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.repeat) return;
          if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault(); if (finish()) onEnter?.();
          }
          if (event.key === "Escape") event.currentTarget.blur();
        }} />
      {error ? <p id={errorId} role="status" className="mt-1 text-[12px] text-[var(--status-error-fg)]">{error}</p> : null}
    </div>
  );
});
