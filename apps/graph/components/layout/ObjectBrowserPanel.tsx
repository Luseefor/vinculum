"use client";

import { useState } from "react";
import ObjectTree from "@/components/objects/ObjectTree";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { SearchIcon } from "@/components/layout/icons";
import { formatMeasurementValue } from "@/lib/measurements/measurementMath";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";

interface ObjectBrowserPanelProps {
  width: number;
}

export default function ObjectBrowserPanel({ width }: ObjectBrowserPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "objects" | "measurements" | "visible">("all");
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => state.scene.objects.filter((object) => object.visible).length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const measurements = useGraphStore((state) => state.scene.measurements);
  const selectedMeasurementId = useGraphStore((state) => state.ui.selectedMeasurementId);
  const removeMeasurement = useGraphStore((state) => state.removeMeasurement);
  const selectMeasurement = useGraphStore((state) => state.selectMeasurement);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addParametricSurface = useGraphStore((state) => state.addParametricSurface);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const updateSurfaceEquation = useGraphStore((state) => state.updateSurfaceEquation);
  const updateSurfaceDomain = useGraphStore((state) => state.updateSurfaceDomain);
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);
  const requestEquationFocus = useGraphStore((state) => state.requestEquationFocus);
  const workspace = useGraphStore((state) => state.ui.workspace);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);

  const createAndFocus = (create: () => string) => {
    const id = create();
    if (id) {
      requestEquationFocus(id);
    }
    return id;
  };

  const createSphere = () => {
    const id = addSurfaceObject();
    updateSurfaceEquation(id, "sqrt(max(0, 9 - x^2 - y^2))");
    updateSurfaceDomain(id, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 });
    addConsoleEvent("Created sphere surface preset");
    return id;
  };

  const createCylinder = () => {
    const id = addSurfaceObject();
    updateSurfaceEquation(id, "sqrt(max(0, 4 - x^2))");
    updateSurfaceDomain(id, { xMin: -2, xMax: 2, yMin: -6, yMax: 6 });
    addConsoleEvent("Created cylinder surface preset");
    return id;
  };

  const createPoint = () => {
    const id = addParametricCurve();
    updateParametricExpression(id, "xExpr", "0");
    updateParametricExpression(id, "yExpr", "0");
    updateParametricExpression(id, "zExpr", "0");
    updateParametricExpression(id, "tMin", 0);
    updateParametricExpression(id, "tMax", 1);
    updateParametricExpression(id, "samples", 2);
    addConsoleEvent("Created point marker preset");
    return id;
  };

  const createParametricSphere = () => {
    const id = addParametricSurface();
    updateParametricSurfaceExpression(id, "xExpr", "sin(u) * cos(v)");
    updateParametricSurfaceExpression(id, "yExpr", "sin(u) * sin(v)");
    updateParametricSurfaceExpression(id, "zExpr", "cos(u)");
    updateParametricSurfaceExpression(id, "uMin", 0);
    updateParametricSurfaceExpression(id, "uMax", 3.1415926536);
    updateParametricSurfaceExpression(id, "vMin", 0);
    updateParametricSurfaceExpression(id, "vMax", 6.2831853072);
    addConsoleEvent("Created parametric sphere preset");
    return id;
  };

  const createParametricTorus = () => {
    const id = addParametricSurface();
    updateParametricSurfaceExpression(id, "xExpr", "(2 + 0.5 * cos(v)) * cos(u)");
    updateParametricSurfaceExpression(id, "yExpr", "(2 + 0.5 * cos(v)) * sin(u)");
    updateParametricSurfaceExpression(id, "zExpr", "0.5 * sin(v)");
    updateParametricSurfaceExpression(id, "uMin", 0);
    updateParametricSurfaceExpression(id, "uMax", 6.2831853072);
    updateParametricSurfaceExpression(id, "vMin", 0);
    updateParametricSurfaceExpression(id, "vMax", 6.2831853072);
    addConsoleEvent("Created parametric torus preset");
    return id;
  };

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--border-strong)] bg-[var(--editor-chrome)] transition-[width] duration-100 motion-reduce:transition-none"
      style={{ width }}
    >
      <div className="flex flex-col gap-1.5 border-b border-[var(--border-subtle)] px-2 py-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Scene Navigator</h2>
          <span
            data-testid="scene-object-count"
            className="flex h-5 min-w-5 items-center justify-center rounded-[6px] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-1.5 font-mono text-[11px] text-[var(--text-muted)]"
          >
            {objectCount}
          </span>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            id="object-search-input"
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search objects..."
            aria-label="Search objects"
            className="h-8 w-full rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] pl-8 pr-2 text-[12px] outline-none transition-all focus:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
        </div>
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-0.5 text-[12px]" role="group" aria-label="Object list filter">
          {(["all", "objects", "measurements", "visible"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`h-7 shrink-0 whitespace-nowrap rounded-[5px] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98] ${filter === key ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {key}
            </button>
          ))}
        </div>

        <Button
          variant="secondary"
          className="h-8 w-full rounded-[6px] border-[var(--border-strong)] bg-[var(--surface-raised)] text-[12px] font-semibold"
          onClick={() => {
            createAndFocus(() => addEmptyObject());
            addConsoleEvent("Added new object");
          }}
        >
          + Add Object
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        {(filter === "all" || filter === "objects" || filter === "visible") && (
          <details open className="mb-2 border-b border-[var(--border-subtle)] pb-2">
            <summary className="cursor-pointer px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Objects</summary>
            <ObjectTree filterQuery={searchQuery} visibleOnly={filter === "visible"} />
          </details>
        )}
        {(filter === "all" || filter === "measurements") && (
          <details open className="space-y-1">
            <summary className="cursor-pointer px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Measurements</summary>
            {measurements.length === 0 ? (
              <div className="mx-1 rounded-[8px] border border-dashed border-[var(--border-subtle)] px-2 py-2 text-[12px] text-[var(--text-tertiary)]">
                No measurements yet.
              </div>
            ) : (
              measurements.map((measurement) => {
                const isSelected = selectedMeasurementId === measurement.id;
                return (
                  <div
                    key={measurement.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] ${isSelected ? "border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60"}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectMeasurement(measurement.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Delete" || event.key === "Backspace") {
                          event.preventDefault();
                          removeMeasurement(measurement.id);
                          addConsoleEvent(`Deleted measurement ${measurement.kind}`);
                        }
                      }}
                      className="min-w-0 truncate text-left"
                    >
                      <span className="mr-1 font-mono text-[11px] uppercase text-[var(--text-tertiary)]">{measurement.kind}</span>
                      <span className="truncate font-medium">{formatMeasurementValue(measurement)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete measurement ${measurement.kind}`}
                      onClick={() => {
                        removeMeasurement(measurement.id);
                        addConsoleEvent(`Deleted measurement ${measurement.kind}`);
                      }}
                      className="h-6 rounded-[6px] border border-transparent px-2 text-[11px] font-medium text-[var(--text-tertiary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    >
                      Del
                    </button>
                  </div>
                );
              })
            )}
          </details>
        )}
      </ScrollArea>

      <div className="border-t border-[var(--border-subtle)] p-2">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Quick Add</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Surface", onClick: () => createAndFocus(() => addSurfaceObject()) },
            { label: "Curve", onClick: () => createAndFocus(() => addParametricCurve()) },
            { label: "Parametric Surface", onClick: () => createAndFocus(() => addParametricSurface()) },
            { label: "Sphere", onClick: () => createAndFocus(createSphere) },
            { label: "Cylinder", onClick: () => createAndFocus(createCylinder) },
            { label: "Parametric Sphere", onClick: () => createAndFocus(createParametricSphere) },
            { label: "Parametric Torus", onClick: () => createAndFocus(createParametricTorus) },
            { label: "Plane", onClick: () => createAndFocus(() => addPlaneObject()) },
            { label: "Point", onClick: () => createAndFocus(createPoint) }
          ]
            .slice()
            .sort(
              (a, b) =>
                WORKSPACE_CONTENT[workspace].quickAddOrder.indexOf(a.label) -
                WORKSPACE_CONTENT[workspace].quickAddOrder.indexOf(b.label)
            )
            .map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="h-7 rounded-[6px] border border-[var(--border-subtle)] bg-transparent text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-all duration-100 motion-reduce:transition-none hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]"
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 border-t border-[var(--border-subtle)] pt-1.5 text-[11px] text-[var(--text-tertiary)]">
          <span className="font-mono">{selectedObjectId ? selectedObjectId.slice(0, 8) : "none"}</span>
          <span className="mx-1.5">·</span>
          <span className="font-mono">{visibleCount}</span> visible
        </p>
      </div>
    </aside>
  );
}
