"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { cx } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import type { ExpressionRowProps } from "@/types/graphUi";
import GraphTypeSelector from "./GraphTypeSelector";
import type { ExpressionDiagnostic } from "@/lib/math/expressionDiagnostics";
import {
  getImplicitSurfaceEquationDiagnostics,
  getParametricAxisDiagnostics,
  getParametricSurfaceAxisDiagnostics,
  getPlaneEquationDiagnostics,
  getSurfaceEquationDiagnostics,
  getVectorFieldComponentDiagnostics
} from "@/lib/math/expressionDiagnostics";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

const PARAMETRIC_CURVE_FIELDS = [
  { label: "y(t)", field: "yExpr" as const },
  { label: "z(t)", field: "zExpr" as const }
];

const PARAMETRIC_SURFACE_FIELDS = [
  { label: "y(u,v)", field: "yExpr" as const },
  { label: "z(u,v)", field: "zExpr" as const }
];

const VECTOR_FIELD_2D_FIELDS = [{ label: "Q(x,y)", field: "qExpr" as const }];

const VECTOR_FIELD_3D_FIELDS = [
  { label: "Q(x,y,z)", field: "qExpr" as const },
  { label: "R(x,y,z)", field: "rExpr" as const }
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
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);
  const updateVectorFieldExpression = useGraphStore((state) => state.updateVectorFieldExpression);
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

  const [implicitDraft, setImplicitDraft] = useState(object.kind === "implicitSurface" ? object.equation : "");
  const [implicitDraftDiag, setImplicitDraftDiag] = useState<ExpressionDiagnostic>(() =>
    object.kind === "implicitSurface"
      ? getImplicitSurfaceEquationDiagnostics(object.equation)
      : { status: "valid", message: "" }
  );

  const parametricObject =
    object.kind === "parametricCurve" || object.kind === "parametricSurface" ? object : null;

  const [xDraft, setXDraft] = useState(parametricObject ? parametricObject.xExpr : "");
  const [yDraft, setYDraft] = useState(parametricObject ? parametricObject.yExpr : "");
  const [zDraft, setZDraft] = useState(parametricObject ? parametricObject.zExpr : "");  const [activeParametricField, setActiveParametricField] = useState<"xExpr" | "yExpr" | "zExpr">("xExpr");
  const [paramDraftDiag, setParamDraftDiag] = useState<ExpressionDiagnostic>(() => {
    if (!parametricObject) return { status: "valid", message: "" };
    const getInitialAxisDiagnostics =
      parametricObject.kind === "parametricSurface"
        ? getParametricSurfaceAxisDiagnostics
        : getParametricAxisDiagnostics;
    return getInitialAxisDiagnostics({
      field: "xExpr",
      xExpr: parametricObject.xExpr,
      yExpr: parametricObject.yExpr,
      zExpr: parametricObject.zExpr
    });
  });

  // S20: vector-field component drafts mirror the parametric pattern (P is
  // the primary input and registers for creation focus).
  const vectorObject = object.kind === "vectorField" ? object : null;

  const [pDraft, setPDraft] = useState(vectorObject ? vectorObject.pExpr : "");
  const [qDraft, setQDraft] = useState(vectorObject ? vectorObject.qExpr : "");
  const [rDraft, setRDraft] = useState(vectorObject ? vectorObject.rExpr : "");
  const [activeVectorField, setActiveVectorField] = useState<"pExpr" | "qExpr" | "rExpr">("pExpr");
  const [vectorDraftDiag, setVectorDraftDiag] = useState<ExpressionDiagnostic>(() => {
    if (!vectorObject) return { status: "valid", message: "" };
    return getVectorFieldComponentDiagnostics({
      field: "pExpr",
      dimension: vectorObject.dimension,
      pExpr: vectorObject.pExpr,
      qExpr: vectorObject.qExpr,
      rExpr: vectorObject.rExpr
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
    if (object.kind === "implicitSurface") {
      setImplicitDraft(object.equation);
      setImplicitDraftDiag(getImplicitSurfaceEquationDiagnostics(object.equation));
      return;
    }
    if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
      setXDraft(object.xExpr);
      setYDraft(object.yExpr);
      setZDraft(object.zExpr);
      const getAxisDiagnostics =
        object.kind === "parametricSurface" ? getParametricSurfaceAxisDiagnostics : getParametricAxisDiagnostics;
      const diagX = getAxisDiagnostics({
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

      const diagY = getAxisDiagnostics({
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

      const diagZ = getAxisDiagnostics({
        field: "zExpr",
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr
      });
      setActiveParametricField(diagZ.status === "error" ? "zExpr" : "xExpr");
      setParamDraftDiag(diagZ);
    }
    if (object.kind === "vectorField") {
      setPDraft(object.pExpr);
      setQDraft(object.qExpr);
      setRDraft(object.rExpr);
      const fields = [
        { field: "pExpr" as const, value: object.pExpr },
        { field: "qExpr" as const, value: object.qExpr },
        ...(object.dimension === "3d" ? [{ field: "rExpr" as const, value: object.rExpr }] : [])
      ];
      for (const entry of fields) {
        const diag = getVectorFieldComponentDiagnostics({
          field: entry.field,
          dimension: object.dimension,
          pExpr: object.pExpr,
          qExpr: object.qExpr,
          rExpr: object.rExpr
        });
        if (diag.status === "error") {
          setActiveVectorField(entry.field);
          setVectorDraftDiag(diag);
          return;
        }
      }
      setActiveVectorField("pExpr");
      setVectorDraftDiag(
        getVectorFieldComponentDiagnostics({
          field: "pExpr",
          dimension: object.dimension,
          pExpr: object.pExpr,
          qExpr: object.qExpr,
          rExpr: object.rExpr
        })
      );
    }
  }, [object]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef({
    surfaceDraft,
    planeDraft,
    implicitDraft,
    xDraft,
    yDraft,
    zDraft,
    activeParametricField,
    pDraft,
    qDraft,
    rDraft,
    activeVectorField
  });

  useEffect(() => {
    latestDraftRef.current = {
      surfaceDraft,
      planeDraft,
      implicitDraft,
      xDraft,
      yDraft,
      zDraft,
      activeParametricField,
      pDraft,
      qDraft,
      rDraft,
      activeVectorField
    };
  }, [surfaceDraft, planeDraft, implicitDraft, xDraft, yDraft, zDraft, activeParametricField, pDraft, qDraft, rDraft, activeVectorField]);

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

  const commitImplicitEquationIfValid = (nextEquation: string) => {
    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || current.kind !== "implicitSurface") return;
    const compiled = compileImplicitSurfaceExpression(nextEquation, getEditorParameterScope());
    if (compiled.error) return;
    if (current.equation === nextEquation) return;
    updateImplicitSurfaceExpression(object.id, "equation", nextEquation);
  };

  const commitParametricAxisIfValid = (field: "xExpr" | "yExpr" | "zExpr", nextValue: string) => {    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || (current.kind !== "parametricCurve" && current.kind !== "parametricSurface")) return;
    const compileForKind =
      current.kind === "parametricSurface"
        ? (xExpr: string, yExpr: string, zExpr: string) =>
            compileParametricSurfaceExpressions(xExpr, yExpr, zExpr, getEditorParameterScope())
        : compileParametricExpressions;
    const compiled = compileForKind(
      field === "xExpr" ? nextValue : xDraft,
      field === "yExpr" ? nextValue : yDraft,
      field === "zExpr" ? nextValue : zDraft
    );
    if (compiled.error) return;
    if (current[field] === nextValue) return;
    if (current.kind === "parametricSurface") {
      updateParametricSurfaceExpression(object.id, field, nextValue);
      return;
    }
    updateParametricExpression(object.id, field, nextValue);
  };

  const commitVectorFieldAxisIfValid = (field: "pExpr" | "qExpr" | "rExpr", nextValue: string) => {
    const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
    if (!current || current.kind !== "vectorField") return;
    const compiled = compileVectorFieldExpressions(
      current.dimension,
      field === "pExpr" ? nextValue : pDraft,
      field === "qExpr" ? nextValue : qDraft,
      field === "rExpr" ? nextValue : rDraft,
      getEditorParameterScope()
    );
    if (compiled.error) return;
    if (current[field] === nextValue) return;
    updateVectorFieldExpression(object.id, field, nextValue);
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

      if (object.kind === "implicitSurface") {
        commitImplicitEquationIfValid(latest.implicitDraft);
        return;
      }

      if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
        const compileForKind =
          object.kind === "parametricSurface"
            ? (xExpr: string, yExpr: string, zExpr: string) =>
                compileParametricSurfaceExpressions(xExpr, yExpr, zExpr, getEditorParameterScope())
            : compileParametricExpressions;
        const compiled = compileForKind(latest.xDraft, latest.yDraft, latest.zDraft);
        if (compiled.error) return;

        const field = latest.activeParametricField;
        const nextValue = field === "xExpr" ? latest.xDraft : field === "yExpr" ? latest.yDraft : latest.zDraft;
        const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
        if (!current || current.kind !== object.kind) return;
        if (current[field] === nextValue) return;

        if (object.kind === "parametricSurface") {
          updateParametricSurfaceExpression(object.id, field, nextValue);
          return;
        }
        updateParametricExpression(object.id, field, nextValue);
      }

      if (object.kind === "vectorField") {
        const compiled = compileVectorFieldExpressions(
          object.dimension,
          latest.pDraft,
          latest.qDraft,
          latest.rDraft,
          getEditorParameterScope()
        );
        if (compiled.error) return;

        const field = latest.activeVectorField;
        const nextValue = field === "pExpr" ? latest.pDraft : field === "qExpr" ? latest.qDraft : latest.rDraft;
        const current = useGraphStore.getState().scene.objects.find((o) => o.id === object.id);
        if (!current || current.kind !== "vectorField") return;
        if (current[field] === nextValue) return;
        updateVectorFieldExpression(object.id, field, nextValue);
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
    if (object.kind === "implicitSurface" && inputId.endsWith("-implicit")) {
      commitImplicitEquationIfValid(implicitDraft);
      return;
    }
    if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
      if (inputId.endsWith("-xExpr")) commitParametricAxisIfValid("xExpr", xDraft);
      if (inputId.endsWith("-yExpr")) commitParametricAxisIfValid("yExpr", yDraft);
      if (inputId.endsWith("-zExpr")) commitParametricAxisIfValid("zExpr", zDraft);
    }
    if (object.kind === "vectorField") {
      if (inputId.endsWith("-pExpr")) commitVectorFieldAxisIfValid("pExpr", pDraft);
      if (inputId.endsWith("-qExpr")) commitVectorFieldAxisIfValid("qExpr", qDraft);
      if (inputId.endsWith("-rExpr")) commitVectorFieldAxisIfValid("rExpr", rDraft);
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
    if (object.kind === "implicitSurface" && inputId.endsWith("-implicit")) {
      setImplicitDraft(object.equation);
      setImplicitDraftDiag(getImplicitSurfaceEquationDiagnostics(object.equation));
      return;
    }
    if (object.kind === "parametricCurve" || object.kind === "parametricSurface") {
      const getRevertAxisDiagnostics =
        object.kind === "parametricSurface" ? getParametricSurfaceAxisDiagnostics : getParametricAxisDiagnostics;
      if (inputId.endsWith("-xExpr")) {
        setXDraft(object.xExpr);
        setActiveParametricField("xExpr");
        setParamDraftDiag(getRevertAxisDiagnostics({ field: "xExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
      if (inputId.endsWith("-yExpr")) {
        setYDraft(object.yExpr);
        setActiveParametricField("yExpr");
        setParamDraftDiag(getRevertAxisDiagnostics({ field: "yExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
      if (inputId.endsWith("-zExpr")) {
        setZDraft(object.zExpr);
        setActiveParametricField("zExpr");
        setParamDraftDiag(getRevertAxisDiagnostics({ field: "zExpr", xExpr: object.xExpr, yExpr: object.yExpr, zExpr: object.zExpr }));
      }
    }
    if (object.kind === "vectorField") {
      if (inputId.endsWith("-pExpr")) {
        setPDraft(object.pExpr);
        setActiveVectorField("pExpr");
        setVectorDraftDiag(
          getVectorFieldComponentDiagnostics({
            field: "pExpr",
            dimension: object.dimension,
            pExpr: object.pExpr,
            qExpr: object.qExpr,
            rExpr: object.rExpr
          })
        );
      }
      if (inputId.endsWith("-qExpr")) {
        setQDraft(object.qExpr);
        setActiveVectorField("qExpr");
        setVectorDraftDiag(
          getVectorFieldComponentDiagnostics({
            field: "qExpr",
            dimension: object.dimension,
            pExpr: object.pExpr,
            qExpr: object.qExpr,
            rExpr: object.rExpr
          })
        );
      }
      if (inputId.endsWith("-rExpr")) {
        setRDraft(object.rExpr);
        setActiveVectorField("rExpr");
        setVectorDraftDiag(
          getVectorFieldComponentDiagnostics({
            field: "rExpr",
            dimension: object.dimension,
            pExpr: object.pExpr,
            qExpr: object.qExpr,
            rExpr: object.rExpr
          })
        );
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
        : object.kind === "implicitSurface"
          ? implicitDraftDiag
          : object.kind === "vectorField"
            ? vectorDraftDiag
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
      onInsertBelow(
        object.id,
        object.kind,
        object.kind === "vectorField" ? object.dimension : undefined
      );
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
          className="color-swatch h-6 w-6 shrink-0 rounded-[var(--radius-sm)]"
        />

        <GraphTypeSelector
          value={object.kind}
          dimension={object.kind === "vectorField" ? object.dimension : undefined}
          onChange={(nextKind, nextDimension) => setObjectKind(object.id, nextKind, nextDimension)}
        />

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleObjectVisibility(object.id);
            }}
            className={cx(
              "flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-transparent transition-colors",
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
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
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
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--text-tertiary)] transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
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
          className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
        />
      )}

      {(object.kind === "parametricCurve" || object.kind === "parametricSurface") && (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1.5">
          <label htmlFor={`${inputIdBase}-xExpr`} className="text-[11px] font-medium text-[var(--text-tertiary)]">
            {object.kind === "parametricSurface" ? "x(u,v)" : "x(t)"}
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
              setParamDraftDiag(
                (object.kind === "parametricSurface"
                  ? getParametricSurfaceAxisDiagnostics
                  : getParametricAxisDiagnostics)({ field: "xExpr", xExpr: next, yExpr: yDraft, zExpr: zDraft })
              );
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
            className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
          />

          {(object.kind === "parametricSurface" ? PARAMETRIC_SURFACE_FIELDS : PARAMETRIC_CURVE_FIELDS).map((entry) => (
            <ParametricInput
              key={entry.field}
              id={`${inputIdBase}-${entry.field}`}
              label={entry.label}
              value={entry.field === "yExpr" ? yDraft : zDraft}
              onFocus={() => onSelect(object.id)}
              onChange={(event) => {
                const next = event.target.value;
                const getChangeAxisDiagnostics =
                  object.kind === "parametricSurface"
                    ? getParametricSurfaceAxisDiagnostics
                    : getParametricAxisDiagnostics;
                if (entry.field === "yExpr") {
                  setYDraft(next);
                  setActiveParametricField("yExpr");
                  setParamDraftDiag(getChangeAxisDiagnostics({ field: "yExpr", xExpr: xDraft, yExpr: next, zExpr: zDraft }));
                } else {
                  setZDraft(next);
                  setActiveParametricField("zExpr");
                  setParamDraftDiag(getChangeAxisDiagnostics({ field: "zExpr", xExpr: xDraft, yExpr: yDraft, zExpr: next }));
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
              onKeyDown={handlePrimaryKeyDown}
              ariaInvalid={paramDraftDiag.status === "error" && activeParametricField === entry.field}
              ariaDescribedBy={`${inputIdBase}-diagnostic`}
            />
          ))}
        </div>
      )}

      {object.kind === "vectorField" && (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1.5">
          <label htmlFor={`${inputIdBase}-pExpr`} className="text-[11px] font-medium text-[var(--text-tertiary)]">
            {object.dimension === "3d" ? "P(x,y,z)" : "P(x,y)"}
          </label>
          <input
            id={`${inputIdBase}-pExpr`}
            ref={(node) => registerInputRef(object.id, node)}
            type="text"
            value={pDraft}
            onFocus={() => onSelect(object.id)}
            onChange={(event) => {
              const next = event.target.value;
              setPDraft(next);
              setActiveVectorField("pExpr");
              setVectorDraftDiag(
                getVectorFieldComponentDiagnostics({
                  field: "pExpr",
                  dimension: object.dimension,
                  pExpr: next,
                  qExpr: qDraft,
                  rExpr: rDraft
                })
              );
              scheduleDebouncedCommit();
            }}
            onBlur={() => {
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
              }
              commitVectorFieldAxisIfValid("pExpr", pDraft);
            }}
            onKeyDown={handlePrimaryKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="P component"
            aria-invalid={vectorDraftDiag.status === "error" && activeVectorField === "pExpr"}
            aria-describedby={`${inputIdBase}-diagnostic`}
            placeholder="x"
            className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
          />

          {(object.dimension === "3d" ? VECTOR_FIELD_3D_FIELDS : VECTOR_FIELD_2D_FIELDS).map((entry) => (
            <ParametricInput
              key={entry.field}
              id={`${inputIdBase}-${entry.field}`}
              label={entry.label}
              ariaLabel={`${entry.field === "qExpr" ? "Q" : "R"} component`}
              value={entry.field === "qExpr" ? qDraft : rDraft}
              onFocus={() => onSelect(object.id)}
              onChange={(event) => {
                const next = event.target.value;
                if (entry.field === "qExpr") {
                  setQDraft(next);
                  setActiveVectorField("qExpr");
                  setVectorDraftDiag(
                    getVectorFieldComponentDiagnostics({
                      field: "qExpr",
                      dimension: object.dimension,
                      pExpr: pDraft,
                      qExpr: next,
                      rExpr: rDraft
                    })
                  );
                } else {
                  setRDraft(next);
                  setActiveVectorField("rExpr");
                  setVectorDraftDiag(
                    getVectorFieldComponentDiagnostics({
                      field: "rExpr",
                      dimension: object.dimension,
                      pExpr: pDraft,
                      qExpr: qDraft,
                      rExpr: next
                    })
                  );
                }
                scheduleDebouncedCommit();
              }}
              onBlur={() => {
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                if (entry.field === "qExpr") commitVectorFieldAxisIfValid("qExpr", qDraft);
                if (entry.field === "rExpr") commitVectorFieldAxisIfValid("rExpr", rDraft);
              }}
              onKeyDown={handlePrimaryKeyDown}
              ariaInvalid={vectorDraftDiag.status === "error" && activeVectorField === entry.field}
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
          className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
        />
      )}

      {object.kind === "implicitSurface" && (
        <input
          id={`${inputIdBase}-implicit`}
          ref={(node) => registerInputRef(object.id, node)}
          type="text"
          value={implicitDraft}
          onFocus={() => onSelect(object.id)}
          onChange={(event) => {
            const next = event.target.value;
            setImplicitDraft(next);
            setImplicitDraftDiag(getImplicitSurfaceEquationDiagnostics(next));
            scheduleDebouncedCommit();
          }}
          onBlur={() => {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
            commitImplicitEquationIfValid(implicitDraft);
          }}
          onKeyDown={handlePrimaryKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Implicit surface equation"
          aria-invalid={implicitDraftDiag.status === "error"}
          aria-describedby={`${inputIdBase}-diagnostic`}
          placeholder="x^2 + y^2 + z^2 = 1"
          className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
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
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaLabel?: string;
}

function ParametricInput({
  id,
  label,
  value,
  onFocus,
  onChange,
  onBlur,
  onKeyDown,
  ariaInvalid,
  ariaDescribedBy,
  ariaLabel
}: ParametricInputProps) {
  return (
    <>
      <label htmlFor={id} className="text-[11px] font-medium text-[var(--text-tertiary)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onFocus={onFocus}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete="off"
        aria-label={ariaLabel ?? `Parametric ${label}`}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className="input h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 text-[13px]"
      />
    </>
  );
}
