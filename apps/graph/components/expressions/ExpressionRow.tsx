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
    "relative overflow-hidden rounded-xl border bg-card p-2.5 transition-colors",
    isSelected
      ? "border-primary/80 bg-primary/[0.09] ring-1 ring-primary/45"
      : "border-border/80 hover:border-primary/40",
    validation.error && "border-destructive/70"
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
        <span className="w-6 shrink-0 text-center font-mono text-[1.02rem] text-muted-foreground">{rowIndex + 1}</span>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg border-border/80 p-0"
          onClick={(event) => {
            event.stopPropagation();
            colorInputRef.current?.click();
          }}
          title="Expression color"
        >
          <span
            className="h-5 w-5 rounded-[4px] border border-foreground/20"
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

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant={object.visible ? "secondary" : "outline"}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              toggleObjectVisibility(object.id);
            }}
            className="h-9 min-w-[3.1rem] rounded-lg border-border/80 px-2 text-[0.92rem] font-semibold"
            aria-pressed={object.visible}
            title={object.visible ? "Hide graph" : "Show graph"}
          >
            {object.visible ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
            {object.visible ? "ON" : "OFF"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onOpenInspector(object.id);
            }}
            className="h-9 rounded-lg border-border/80 px-2.5 text-[0.9rem]"
            title="Open inspector"
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            EDIT
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(object.id, "button");
            }}
            className="h-9 rounded-lg border-border/80 px-2.5 text-[0.9rem] text-muted-foreground hover:text-destructive"
            title="Delete expression"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            DEL
          </Button>
        </div>
      </div>

      {object.kind === "surface" ? (
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
          className="h-14 rounded-lg border-border/80 bg-background/95 px-4 font-mono text-[1.85rem] leading-none tracking-tight"
        />
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
            className="h-9 rounded-lg border-border/80 bg-background/95 font-mono text-xs"
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
          className="h-12 rounded-lg border-border/80 bg-background/95 px-4 font-mono text-[1.25rem] leading-none"
        />
      ) : null}

      {validation.error ? (
        <p className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
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
        className="h-9 rounded-lg border-border/80 bg-background/95 font-mono text-xs"
      />
    </>
  );
}
