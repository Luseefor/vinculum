"use client";

import { useMemo } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { cx } from "@/components/ui/styles";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { useGraphStore } from "@/store/graphStore";
import type { ExpressionRowProps, ExpressionValidationState } from "@/types/graphUi";
import GraphTypeSelector from "./GraphTypeSelector";

const PARAMETRIC_FIELDS = [
  { label: "y(t)", field: "yExpr" as const },
  { label: "z(t)", field: "zExpr" as const }
];

export default function ExpressionRow({
  object,
  isSelected,
  canRemoveWithBackspace,
  registerInputRef,
  onSelect,
  onMoveFocus,
  onInsertBelow,
  onRemove,
  onOpenInspector
}: ExpressionRowProps) {
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);

  const validation = useMemo<ExpressionValidationState>(() => {
    if (object.kind === "surface") {
      return { error: compileSurfaceExpression(object.equation).error };
    }

    if (object.kind === "parametricCurve") {
      return {
        error: compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr).error
      };
    }

    return { error: compilePlaneEquation(object.equation).error };
  }, [object]);

  const handlePrimaryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;

    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      onInsertBelow(object.id, object.kind);
      return;
    }

    if (
      event.key === "Backspace" &&
      canRemoveWithBackspace &&
      input.value.length === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      onRemove(object.id, "keyboard");
      return;
    }

    if (event.key === "ArrowUp" && selectionStart === 0 && selectionEnd === 0) {
      event.preventDefault();
      onMoveFocus(object.id, "up");
      return;
    }

    if (
      event.key === "ArrowDown" &&
      selectionStart === input.value.length &&
      selectionEnd === input.value.length
    ) {
      event.preventDefault();
      onMoveFocus(object.id, "down");
    }
  };

  return (
    <div
      className={cx(
        "panel px-3 py-2.5 cursor-pointer transition-all duration-150",
        isSelected && "ring-1 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface-bg)]",
        validation.error && "ring-1 ring-amber-500/50"
      )}
      onClick={() => onSelect(object.id)}
      role="button"
      tabIndex={-1}
      aria-label="Expression row"
    >
      {/* Header row with color, type, and actions */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          aria-label="Expression color"
          value={object.color}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="color-swatch"
        />

        <GraphTypeSelector
          value={object.kind}
          onChange={(nextKind) => setObjectKind(object.id, nextKind)}
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleObjectVisibility(object.id);
            }}
            className={cx(
              "w-6 h-6 flex items-center justify-center rounded transition-colors",
              object.visible 
                ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]" 
                : "text-[var(--text-tertiary)] opacity-50"
            )}
            title={object.visible ? "Hide" : "Show"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {object.visible ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInspector(object.id);
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Inspect"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(object.id, "button");
            }}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
            title="Remove"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expression input */}
      {object.kind === "surface" && (
        <input
          ref={(node) => registerInputRef(object.id, node)}
          type="text"
          value={object.equation}
          onFocus={() => onSelect(object.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateSurfaceEquation(object.id, event.target.value)}
          onKeyDown={handlePrimaryKeyDown}
          spellCheck={false}
          autoComplete="off"
          placeholder="z = sin(x) * cos(y)"
          className="input"
        />
      )}

      {object.kind === "parametricCurve" && (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1.5">
          <label className="text-[10px] font-medium text-[var(--text-tertiary)]">x(t)</label>
          <input
            ref={(node) => registerInputRef(object.id, node)}
            type="text"
            value={object.xExpr}
            onFocus={() => onSelect(object.id)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateParametricExpression(object.id, "xExpr", event.target.value)}
            onKeyDown={handlePrimaryKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="input text-xs py-1.5"
          />

          {PARAMETRIC_FIELDS.map((entry) => (
            <ParametricInput
              key={entry.field}
              label={entry.label}
              value={object[entry.field]}
              onFocus={() => onSelect(object.id)}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateParametricExpression(object.id, entry.field, event.target.value)}
            />
          ))}
        </div>
      )}

      {object.kind === "plane" && (
        <input
          ref={(node) => registerInputRef(object.id, node)}
          type="text"
          value={object.equation}
          onFocus={() => onSelect(object.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updatePlaneEquation(object.id, event.target.value)}
          onKeyDown={handlePrimaryKeyDown}
          spellCheck={false}
          autoComplete="off"
          placeholder="ax + by + cz + d = 0"
          className="input"
        />
      )}

      {validation.error && (
        <p className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-1.5 text-[11px] text-amber-400">
          {validation.error}
        </p>
      )}
    </div>
  );
}

interface ParametricInputProps {
  label: string;
  value: string;
  onFocus: () => void;
  onClick: (event: MouseEvent<HTMLInputElement>) => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function ParametricInput({ label, value, onFocus, onClick, onChange }: ParametricInputProps) {
  return (
    <>
      <label className="text-[10px] font-medium text-[var(--text-tertiary)]">{label}</label>
      <input
        type="text"
        value={value}
        onFocus={onFocus}
        onClick={onClick}
        onChange={onChange}
        spellCheck={false}
        autoComplete="off"
        className="input text-xs py-1.5"
      />
    </>
  );
}
