"use client";

import { useMemo, useRef } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import { Eye, EyeOff, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { compilePlaneEquation } from "@/lib/math/samplePlane";
import { useGraphStore } from "@/store/graphStore";
import type { ExpressionRowProps, ExpressionValidationState } from "@/types/graphUi";
import GraphTypeSelector from "./GraphTypeSelector";

const PARAMETRIC_FIELDS = [
  { label: "y(t)", field: "yExpr" as const },
  { label: "z(t)", field: "zExpr" as const }
];

export default function ExpressionRow({
  rowIndex,
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

  const colorInputRef = useRef<HTMLInputElement | null>(null);

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

  const rowClassName = cn(
    "relative overflow-hidden rounded-lg border bg-card p-2.5 transition-colors",
    isSelected
      ? "border-primary/70 ring-2 ring-primary/25"
      : "border-border/80 hover:border-primary/35",
    validation.error && "border-destructive/60"
  );

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
      className={rowClassName}
      onClick={() => onSelect(object.id)}
      role="button"
      tabIndex={-1}
      aria-label="Expression row"
    >
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: object.color }}
      />

      <div className="mb-2 flex items-center gap-2 pl-1">
        <span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
          {rowIndex + 1}
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 p-0"
          onClick={(event) => {
            event.stopPropagation();
            colorInputRef.current?.click();
          }}
          title="Expression color"
        >
          <span
            className="h-4 w-4 rounded-sm border border-foreground/20"
            style={{ backgroundColor: object.color }}
          />
        </Button>

        <input
          ref={colorInputRef}
          type="color"
          aria-label="Expression color"
          value={object.color}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => updateObjectColor(object.id, event.target.value)}
          className="sr-only"
        />

        <GraphTypeSelector
          value={object.kind}
          onChange={(nextKind) => {
            setObjectKind(object.id, nextKind);
          }}
        />

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant={object.visible ? "secondary" : "outline"}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              toggleObjectVisibility(object.id);
            }}
            className="h-8 px-2"
            aria-pressed={object.visible}
            title={object.visible ? "Hide graph" : "Show graph"}
          >
            {object.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInspector(object.id);
            }}
            className="h-8 px-2"
            title="Open inspector"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(object.id, "button");
            }}
            className="h-8 px-2 text-muted-foreground hover:text-destructive"
            title="Delete expression"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {object.kind === "surface" ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            z=
          </span>
          <Input
            ref={(node) => registerInputRef(object.id, node)}
            type="text"
            value={object.equation}
            onFocus={() => onSelect(object.id)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateSurfaceEquation(object.id, event.target.value)}
            onKeyDown={handlePrimaryKeyDown}
            spellCheck={false}
            autoComplete="off"
            placeholder="sin(x) * cos(y)"
            className="h-12 border-border/80 bg-background/95 pl-10 font-mono text-[1.8rem] leading-none tracking-tight"
          />
        </div>
      ) : null}

      {object.kind === "parametricCurve" ? (
        <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">x(t)</label>
          <Input
            ref={(node) => registerInputRef(object.id, node)}
            type="text"
            value={object.xExpr}
            onFocus={() => onSelect(object.id)}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => updateParametricExpression(object.id, "xExpr", event.target.value)}
            onKeyDown={handlePrimaryKeyDown}
            spellCheck={false}
            autoComplete="off"
            className="h-9 border-border/80 bg-background/85 font-mono text-xs"
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
      ) : null}

      {object.kind === "plane" ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            plane
          </span>
          <Input
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
            className="h-11 border-border/80 bg-background/95 pl-[4.5rem] font-mono text-sm"
          />
        </div>
      ) : null}

      {validation.error ? (
        <p className="mt-2 rounded-md border border-destructive/45 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {validation.error}
        </p>
      ) : null}
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
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      <Input
        type="text"
        value={value}
        onFocus={onFocus}
        onClick={onClick}
        onChange={onChange}
        spellCheck={false}
        autoComplete="off"
        className="h-9 border-border/80 bg-background/85 font-mono text-xs"
      />
    </>
  );
}
