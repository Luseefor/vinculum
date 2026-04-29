"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useEditorStore,
  type ConstraintAxis,
  type EditorConstraint,
  type EditorConstraintType
} from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

export default function ConstraintsTab() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const constraints = useEditorStore((state) => state.constraints);
  const addConstraint = useEditorStore((state) => state.addConstraint);
  const updateConstraintAxisLocks = useEditorStore((state) => state.updateConstraintAxisLocks);
  const updateConstraintOffsetValue = useEditorStore((state) => state.updateConstraintOffsetValue);
  const toggleConstraint = useEditorStore((state) => state.toggleConstraint);
  const removeConstraint = useEditorStore((state) => state.removeConstraint);
  const [targetObjectId, setTargetObjectId] = useState<string>("");

  const targetOptions = useMemo(
    () => objects.filter((object) => object.id !== selectedObjectId),
    [objects, selectedObjectId]
  );

  useEffect(() => {
    if (!selectedObjectId) {
      setTargetObjectId("");
      return;
    }
    const firstTarget = targetOptions[0]?.id ?? "";
    setTargetObjectId((current) => {
      if (current && targetOptions.some((option) => option.id === current)) {
        return current;
      }
      return firstTarget;
    });
  }, [selectedObjectId, targetOptions]);

  const outgoingConstraints = constraints.filter((constraint) =>
    selectedObjectId ? constraint.objectIds[0] === selectedObjectId : false
  );
  const incomingConstraints = constraints.filter((constraint) =>
    selectedObjectId ? constraint.objectIds[1] === selectedObjectId : false
  );
  const canCreateLink = Boolean(selectedObjectId && targetObjectId);

  const add = (type: EditorConstraintType) => {
    if (!selectedObjectId || !targetObjectId || selectedObjectId === targetObjectId) {
      return;
    }
    addConstraint(type, [selectedObjectId, targetObjectId]);
  };

  const labelForObject = (id: string) => {
    const index = objects.findIndex((object) => object.id === id);
    if (index === -1) {
      return id.slice(0, 8);
    }
    return `${objects[index].kind} #${index + 1}`;
  };

  const selectedLabel = selectedObjectId ? labelForObject(selectedObjectId) : "None";

  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="p-3 pb-0">
        <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Links</h3>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          Create relation rules between a source object and a target object.
        </p>
      </CardHeader>

      <CardContent className="space-y-3 p-3 pt-3">
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Source object</p>
          <p className="mt-1 text-[11px] font-medium text-[var(--text-primary)]">{selectedLabel}</p>
        </div>

        <label className="block space-y-1">
          <span className="block text-[10px] text-[var(--text-secondary)]">Target object</span>
          <select
            value={targetObjectId}
            onChange={(event) => setTargetObjectId(event.target.value)}
            disabled={!selectedObjectId || targetOptions.length === 0}
            className="h-8 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 text-[11px] disabled:opacity-60"
          >
            {targetOptions.length === 0 ? (
              <option value="">No other objects</option>
            ) : (
              targetOptions.map((object) => (
                <option key={object.id} value={object.id}>
                  {labelForObject(object.id)}
                </option>
              ))
            )}
          </select>
          {selectedObjectId && targetOptions.length === 0 && (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Add another object first to create a link.
            </p>
          )}
        </label>

        <div className="grid grid-cols-1 gap-2">
          {(
            [
              {
                type: "attach" as const,
                label: "Attach",
                helper: "Mirror source visibility on target."
              },
              {
                type: "align" as const,
                label: "Align",
                helper: "Keep target color aligned with source."
              },
              {
                type: "offset" as const,
                label: "Offset",
                helper: "Apply a lighter color offset from source."
              }
            ] as const
          ).map((item) => (
            <div
              key={item.type}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{item.label}</p>
                <p className="truncate text-[10px] text-[var(--text-tertiary)]">{item.helper}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={() => add(item.type)}
                disabled={!canCreateLink}
              >
                Add
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Outgoing links</p>
          {!selectedObjectId ? (
            <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
              Select an object to manage links.
            </p>
          ) : outgoingConstraints.length === 0 ? (
            <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
              No outgoing links from this object.
            </p>
          ) : (
            outgoingConstraints.map((constraint) => (
              <LinkRow
                key={constraint.id}
                constraint={constraint}
                labelForObject={labelForObject}
                onAxisToggle={updateConstraintAxisLocks}
                onOffsetChange={updateConstraintOffsetValue}
                onToggle={toggleConstraint}
                onRemove={removeConstraint}
              />
            ))
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">Incoming links</p>
          {!selectedObjectId ? (
            <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
              Select an object to inspect incoming links.
            </p>
          ) : incomingConstraints.length === 0 ? (
            <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5 text-[11px] text-[var(--text-tertiary)]">
              No incoming links to this object.
            </p>
          ) : (
            incomingConstraints.map((constraint) => (
              <LinkRow
                key={constraint.id}
                constraint={constraint}
                labelForObject={labelForObject}
                onAxisToggle={updateConstraintAxisLocks}
                onOffsetChange={updateConstraintOffsetValue}
                onToggle={toggleConstraint}
                onRemove={removeConstraint}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LinkRow({
  constraint,
  labelForObject,
  onAxisToggle,
  onOffsetChange,
  onToggle,
  onRemove
}: {
  constraint: EditorConstraint;
  labelForObject: (id: string) => string;
  onAxisToggle: (id: string, axisLocks: Partial<Record<ConstraintAxis, boolean>>) => void;
  onOffsetChange: (id: string, value: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold capitalize text-[var(--text-primary)]">{constraint.type}</p>
          <span
            className={
              constraint.enabled
                ? "rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-500"
                : "rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]"
            }
          >
            {constraint.enabled ? "On" : "Off"}
          </span>
        </div>
        <p className="text-[10px] text-[var(--text-secondary)]">
          {labelForObject(constraint.objectIds[0] ?? "")}
          {" -> "}
          {labelForObject(constraint.objectIds[1] ?? "")}
        </p>
        <p className="truncate font-mono text-[10px] text-[var(--text-tertiary)]" title={constraint.id}>
          {constraint.id}
        </p>
      </div>
      <div className="grid grid-cols-[auto,1fr] items-center gap-x-2 gap-y-1 text-[10px] text-[var(--text-secondary)]">
        <span>Axis</span>
        <div className="flex items-center gap-1">
          {(["x", "y", "z"] as const).map((axis) => (
            <button
              key={axis}
              type="button"
              aria-pressed={constraint.axisLocks[axis]}
              onClick={() => onAxisToggle(constraint.id, { [axis]: !constraint.axisLocks[axis] })}
              className={`h-5 w-5 rounded border text-[10px] uppercase ${
                constraint.axisLocks[axis]
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-tertiary)]"
              }`}
            >
              {axis}
            </button>
          ))}
        </div>
        <span>Offset</span>
        <input
          type="number"
          value={constraint.offsetValue}
          disabled={constraint.type !== "offset"}
          onChange={(event) => onOffsetChange(constraint.id, Number(event.target.value))}
          className="h-6 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 font-mono text-[10px] text-[var(--text-primary)] disabled:opacity-50"
          min={-255}
          max={255}
          step={1}
          aria-label="Constraint offset"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => onToggle(constraint.id)}>
          {constraint.enabled ? "Disable" : "Enable"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => onRemove(constraint.id)}>
          Remove
        </Button>
      </div>
    </div>
  );
}
