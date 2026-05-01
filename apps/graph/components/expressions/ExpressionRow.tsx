"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { cx } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import type { ExpressionRowProps } from "@/types/graphUi";
import GraphTypeSelector from "./GraphTypeSelector";
import type { ExpressionDiagnostic } from "@/lib/math/expressionDiagnostics";
import {
  getParametricAxisDiagnostics,
  getPlaneEquationDiagnostics,
  getSurfaceEquationDiagnostics
} from "@/lib/math/expressionDiagnostics";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";

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
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updatePlaneEquation = useGraphStore((state) => state.updatePlaneEquation);

  const EXPRESSION_DEBOUNCE_MS = 350;

  const [surfaceDraft, setSurfaceDraft] = useState(object.kind === "surface" ? object.equation : "");
  const [surfaceDraftDiag, setSurfaceDraftDiag] = useState<ExpressionDiagnostic>(() =>
    object.kind === "surface"
      ? getSurfaceEquationDiagnostics(object.equation, object.orientation || "z")
      : { status: "valid", message: "" }
  );

  const [planeDraft, setPlaneDraft] = useState(object.kind === "plane" ? object.equation : "");
  const [planeDraftDiag, setPlaneDraftDiag] = useState<ExpressionDiagnostic>(() =>
    object.kind === "plane" ? getPlaneEquationDiagnostics(object.equation) : { status: "valid", message: "" }
  );

  const [xDraft, setXDraft] = useState(object.kind === "parametricCurve" ? object.xExpr : "");
  const [yDraft, setYDraft] = useState(object.kind === "parametricCurve" ? object.yExpr : "");
  const [zDraft, setZDraft] = useState(object.kind === "parametricCurve" ? object.zExpr : "");
  const [activeParametricField, setActiveParametricField] = useState<"xExpr" | "yExpr" | "zExpr">("xExpr");
  const [paramDraftDiag, setParamDraftDiag] = useState<ExpressionDiagnostic>(() => {
    if (object.kind !== "parametricCurve") return { status: "valid", message: "" };
    return getParametricAxisDiagnostics({
      field: "xExpr",
      xExpr: object.xExpr,
      yExpr: object.yExpr,
      zExpr: object.zExpr
    });
  });

  // Keep drafts synchronized with the last committed scene values.
  useEffect(() => {
    if (object.kind === "surface") {
      setSurfaceDraft(object.equation);
      setSurfaceDraftDiag(getSurfaceEquationDiagnostics(object.equation, object.orientation || "z"));
      return;
    }
    if (object.kind === "plane") {
      setPlaneDraft(object.equation);
      setPlaneDraftDiag(getPlaneEquationDiagnostics(object.equation));
      return;
    }
    if (object.kind === "parametricCurve") {
      setXDraft(object.xExpr);
      setYDraft(object.yExpr);
      setZDraft(object.zExpr);
      const diagX = getParametricAxisDiagnostics({
        field: "xExpr",
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      if (diagX.status === "error") {
        setActiveParametricField("xExpr");
        setParamDraftDiag(diagX);
        return;
      }

      const diagY = getParametricAxisDiagnostics({
        field: "yExpr",
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      if (diagY.status === "error") {
        setActiveParametricField("yExpr");
        setParamDraftDiag(diagY);
        return;
      }

      const diagZ = getParametricAxisDiagnostics({
        field: "zExpr",
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      setActiveParametricField(diagZ.status === "error" ? "zExpr" : "xExpr");
      setParamDraftDiag(diagZ);
    }
  }, [object]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef({
    surfaceDraft,
    planeDraft,
    xDraft,
    yDraft,
    zDraft,
    activeParametricField
  });

  useEffect(() => {
    latestDraftRef.current = {
      surfaceDraft,
      planeDraft,
      xDraft,
      yDraft,
      zDraft,
      activeParametricField
    };
  }, [surfaceDraft, planeDraft, xDraft, yDraft, zDraft, activeParametricField]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const commitSurfaceIfValid = (nextEquation: string) => {
    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || current.kind !== "surface") return;
    const compiled = compileSurfaceExpression(nextEquation, current.orientation || "z");
    if (compiled.error) return;
    if (current.equation === nextEquation) return;
    updateSurfaceEquation(object.id, nextEquation);
  };

  const commitPlaneIfValid = (nextEquation: string) => {
    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || current.kind !== "plane") return;
    const compiled = compilePlaneEquation(nextEquation);
    if (compiled.error) return;
    if (current.equation === nextEquation) return;
    updatePlaneEquation(object.id, nextEquation);
  };

  const commitParametricAxisIfValid = (field: "xExpr" | "yExpr" | "zExpr", nextValue: string) => {
    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || current.kind !== "parametricCurve") return;
    const compiled = compileParametricExpressions(
      field === "xExpr" ? nextValue : xDraft,
      field === "yExpr" ? nextValue : yDraft,
      field === "zExpr" ? nextValue : zDraft
    );
    if (compiled.error) return;
    if (current[field] === nextValue) return;
    updateParametricExpression(object.id, field, nextValue);
  };

  const scheduleDebouncedCommit = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    debounceTimerRef.current = setTimeout(() => {
      const latest = latestDraftRef.current;

      if (object.kind === "surface") {
        commitSurfaceIfValid(latest.surfaceDraft);
        return;
      }

      if (object.kind === "plane") {
        commitPlaneIfValid(latest.planeDraft);
        return;
      }

      if (object.kind === "parametricCurve") {
        const compiled = compileParametricExpressions(latest.xDraft, latest.yDraft, latest.zDraft);
        if (compiled.error) return;

        const field = latest.activeParametricField;
        const nextValue = field === "xExpr" ? latest.xDraft : field === "yExpr" ? latest.yDraft : latest.zDraft;
        const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
        if (!current || current.kind !== "parametricCurve") return;
        if (current[field] === nextValue) return;

        updateParametricExpression(object.id, field, nextValue);
      }
    }, EXPRESSION_DEBOUNCE_MS);
  };

  const commitIfValidForInputId = (inputId: string) => {
    if (object.kind === "surface" && inputId.endsWith("-equation")) {
      commitSurfaceIfValid(surfaceDraft);
      return;
    }
    if (object.kind === "plane" && inputId.endsWith("-plane")) {
      commitPlaneIfValid(planeDraft);
      return;
    }
    if (object.kind === "parametricCurve") {
      if (inputId.endsWith("-xExpr")) commitParametricAxisIfValid("xExpr", xDraft);
      if (inputId.endsWith("-yExpr")) commitParametricAxisIfValid("yExpr", yDraft);
      if (inputId.endsWith("-zExpr")) commitParametricAxisIfValid("zExpr", zDraft);
    }
  };

  const revertDraftForInputId = (inputId: string) => {
    if (object.kind === "surface" && inputId.endsWith("-equation")) {
      setSurfaceDraft(object.equation);
      setSurfaceDraftDiag(getSurfaceEquationDiagnostics(object.equation, object.orientation || "z"));
      return;
    }
    if (object.kind === "plane" && inputId.endsWith("-plane")) {
      setPlaneDraft(object.equation);
      setPlaneDraftDiag(getPlaneEquationDiagnostics(object.equation));
      return;
    }
    if (object.kind === "parametricCurve") {
      if (inputId.endsWith("-xExpr")) {
        setXDraft(object.xExpr);
        setActiveParametricField("xExpr");
        setParamDraftDiag(getParametricAxisDiagnostics({ field: "xExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
      if (inputId.endsWith("-yExpr")) {
        setYDraft(object.yExpr);
        setActiveParametricField("yExpr");
        setParamDraftDiag(getParametricAxisDiagnostics({ field: "yExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
      if (inputId.endsWith("-zExpr")) {
        setZDraft(object.zExpr);
        setActiveParametricField("zExpr");
        setParamDraftDiag(getParametricAxisDiagnostics({ field: "zExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
    }
  };

  const placeholder2d = axis2dPair === "yz" ? "z = y^2" : axis2dPair === "xz" ? "z = x^2" : "y = x^2";
  const inputIdBase = `expr-${object.id}`;
  const rowDraftDiag =
    object.kind === "surface"
      ? surfaceDraftDiag
      : object.kind === "plane"
        ? planeDraftDiag
        : paramDraftDiag;

  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, option, label")) {
      return;
    }

    onSelect(object.id);
  };

  const handlePrimaryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;

    if (event.key === "Escape") {
      event.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      revertDraftForInputId(input.id);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      commitIfValidForInputId(input.id);
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
        "group px-3 py-2.5 transition-colors",
        isSelected && "expr-row--selected shadow-[inset_2px_0_0_var(--accent)]",
        !isSelected && "expr-row--hoverable",
        rowDraftDiag.status === "error" && "shadow-[inset_2px_0_0_rgb(245_158_11_/_0.65)]"
      )}
      onClick={handleRowClick}
      aria-label={`${object.kind} expression row`}
    >
      <div className="mb-2 flex items-center gap-2">
        <input
          type="color"
          aria-label="Expression color"
          value={object.color}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="color-swatch h-6 w-6 shrink-0 rounded-[6px]"
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
              "flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent transition-colors",
              object.visible
                ? "text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] opacity-40 hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]"
            )}
            title={object.visible ? "Hide" : "Show"}
            aria-label={object.visible ? "Hide expression from graph" : "Show expression on graph"}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {object.visible ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M1 1l22 22" />
              )}
            </svg>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInspector(object.id);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            title="Inspect"
            aria-label="Open inspector for this expression"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(object.id, "button");
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent text-[var(--text-tertiary)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
            title="Remove"
            aria-label="Remove expression"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {object.kind === "surface" && (
        <input
          id={`${inputIdBase}-equation`}
          ref={(node) => registerInputRef(object.id, node)}
          type="text"
          value={surfaceDraft}
          onFocus={() => onSelect(object.id)}
          onChange={(event) => {
            const next = event.target.value;
            setSurfaceDraft(next);
            setSurfaceDraftDiag(getSurfaceEquationDiagnostics(next, object.orientation || "z"));
            scheduleDebouncedCommit();
          }}
          onBlur={() => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
            commitSurfaceIfValid(surfaceDraft);
          }}
          onKeyDown={handlePrimaryKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Surface equation"
          aria-invalid={surfaceDraftDiag.status === "error"}
          aria-describedby={`${inputIdBase}-diagnostic`}
          placeholder={graphMode === "2d" ? placeholder2d : "z = sin(x) * cos(y)"}
          className="input h-8 rounded-[6px] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
        />
      )}

      {object.kind === "parametricCurve" && (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1.5">
          <label htmlFor={`${inputIdBase}-xExpr`} className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            x(t)
          </label>
          <input
            id={`${inputIdBase}-xExpr`}
            ref={(node) => registerInputRef(object.id, node)}
            type="text"
            value={xDraft}
            onFocus={() => onSelect(object.id)}
            onChange={(event) => {
              const next = event.target.value;
              setXDraft(next);
              setActiveParametricField("xExpr");
              setParamDraftDiag(getParametricAxisDiagnostics({ field: "xExpr", xExpr: next, yExpr: yDraft, zExpr: zDraft }));
              scheduleDebouncedCommit();
            }}
            onBlur={() => {
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              commitParametricAxisIfValid("xExpr", xDraft);
            }}
            onKeyDown={handlePrimaryKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="Parametric x expression"
            aria-invalid={paramDraftDiag.status === "error" && activeParametricField === "xExpr"}
            aria-describedby={`${inputIdBase}-diagnostic`}
            className="input h-8 rounded-[6px] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
          />

          {PARAMETRIC_FIELDS.map((entry) => (
            <ParametricInput
              key={entry.field}
              id={`${inputIdBase}-${entry.field}`}
              label={entry.label}
              value={entry.field === "yExpr" ? yDraft : zDraft}
              onFocus={() => onSelect(object.id)}
              onChange={(event) => {
                const next = event.target.value;
                if (entry.field === "yExpr") {
                  setYDraft(next);
                  setActiveParametricField("yExpr");
                  setParamDraftDiag(getParametricAxisDiagnostics({ field: "yExpr", xExpr: xDraft, yExpr: next, zExpr: zDraft }));
                } else {
                  setZDraft(next);
                  setActiveParametricField("zExpr");
                  setParamDraftDiag(getParametricAxisDiagnostics({ field: "zExpr", xExpr: xDraft, yExpr: yDraft, zExpr: next }));
                }
                scheduleDebouncedCommit();
              }}
              onBlur={() => {
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                if (entry.field === "yExpr") commitParametricAxisIfValid("yExpr", yDraft);
                if (entry.field === "zExpr") commitParametricAxisIfValid("zExpr", zDraft);
              }}
              ariaInvalid={paramDraftDiag.status === "error" && activeParametricField === entry.field}
              ariaDescribedBy={`${inputIdBase}-diagnostic`}
            />
          ))}
        </div>
      )}

      {object.kind === "plane" && (
        <input
          id={`${inputIdBase}-plane`}
          ref={(node) => registerInputRef(object.id, node)}
          type="text"
          value={planeDraft}
          onFocus={() => onSelect(object.id)}
          onChange={(event) => {
            const next = event.target.value;
            setPlaneDraft(next);
            setPlaneDraftDiag(getPlaneEquationDiagnostics(next));
            scheduleDebouncedCommit();
          }}
          onBlur={() => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
            commitPlaneIfValid(planeDraft);
          }}
          onKeyDown={handlePrimaryKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Plane equation"
          aria-invalid={planeDraftDiag.status === "error"}
          aria-describedby={`${inputIdBase}-diagnostic`}
          placeholder="ax + by + cz + d = 0"
          className="input h-8 rounded-[6px] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
        />
      )}

      {rowDraftDiag.status === "error" && (
        <p
          id={`${inputIdBase}-diagnostic`}
          data-testid="expression-diagnostic"
          className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400"
          role="alert"
        >
          {rowDraftDiag.message}
          {rowDraftDiag.suggestion ? ` ${rowDraftDiag.suggestion}` : ""}
        </p>
      )}
    </div>
  );
}

interface ParametricInputProps {
  id: string;
  label: string;
  value: string;
  onFocus: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

function ParametricInput({
  id,
  label,
  value,
  onFocus,
  onChange,
  onBlur,
  ariaInvalid,
  ariaDescribedBy
}: ParametricInputProps) {
  return (
    <>
      <label htmlFor={id} className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        spellCheck={false}
        autoComplete="off"
        aria-label={`Parametric ${label}`}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="input h-8 rounded-[6px] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
      />
    </>
  );
}
