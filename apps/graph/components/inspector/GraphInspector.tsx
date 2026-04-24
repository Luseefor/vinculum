"use client";

import { useMemo } from "react";
import { cx } from "@/components/ui/styles";
import type {
  GraphObject,
  ParametricCurveObject,
  PlaneGraphObject,
  SurfaceGraphObject
} from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import AppearanceSection from "./AppearanceSection";
import DomainSection from "./DomainSection";

export default function GraphInspector() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);

  const selectedObject = useMemo<GraphObject | null>(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  if (!selectedObject) {
    return (
      <section
        id="graph-inspector"
        className="border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center"
      >
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to edit its properties.</p>
      </section>
    );
  }

  if (selectedObject.kind === "parametricCurve") {
    return (
      <section id="graph-inspector">
        <ParametricCurveInspector object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "plane") {
    return (
      <section id="graph-inspector">
        <PlaneInspector object={selectedObject} />
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";

  return (
    <section id="graph-inspector">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-1 pb-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedSurfaceObject.color }} />
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Surface {selectedTitle}</h3>
      </div>

      <DomainSection object={selectedSurfaceObject} />
      <AppearanceSection object={selectedSurfaceObject} />
    </section>
  );
}

function ParametricCurveInspector({ object }: { object: ParametricCurveObject }) {
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);

  return (
    <div className="border-b border-[var(--border-subtle)] py-3">
      <h3 className="mb-2 text-[12px] font-semibold text-[var(--text-primary)]">Curve</h3>
      <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        Edit x(t), y(t), z(t) in the list. Domain and sample count apply to both 2D and 3D views.
      </p>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        Parameter range
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">t min</span>
          <input
            type="number"
            value={object.tMin}
            step="any"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMin", v);
              }
            }}
            className="input h-9 rounded-sm border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">t max</span>
          <input
            type="number"
            value={object.tMax}
            step="any"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMax", v);
              }
            }}
            className="input h-9 rounded-sm border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 text-[12px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">Samples</span>
        <input
          type="number"
          min={2}
          value={object.samples}
          onChange={(event) => {
            const v = Number(event.target.value);
            if (Number.isFinite(v)) {
              updateParametricExpression(object.id, "samples", v);
            }
          }}
          className="input h-9 rounded-sm border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 text-[12px]"
        />
      </label>
    </div>
  );
}

function PlaneInspector({ object }: { object: PlaneGraphObject }) {
  const toggleSurfaceWireframe = useGraphStore((state) => state.toggleSurfaceWireframe);

  return (
    <div className="space-y-3 py-3">
      <div>
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Plane</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Edit the plane equation in the list. 2D view shows the intersection with the axis plane you chose in the
          toolbar.
        </p>
      </div>
      <section className="pt-1">
        <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          Appearance
        </h4>
        <div className="flex items-center justify-between border border-[var(--border-subtle)] px-3 py-2.5">
          <p className="text-[12px] font-medium text-[var(--text-primary)]">Wireframe</p>
          <button
            type="button"
            onClick={() => toggleSurfaceWireframe(object.id)}
            aria-pressed={object.appearance.wireframe}
            aria-label={object.appearance.wireframe ? "Disable wireframe" : "Enable wireframe"}
            className={cx(
              "relative h-5 w-10 rounded-full transition-colors",
              object.appearance.wireframe ? "border border-transparent bg-[var(--accent)]" : "toggle-track-muted"
            )}
          >
            <span
              className={cx(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                object.appearance.wireframe ? "left-[20px]" : "left-0.5"
              )}
            />
          </button>
        </div>
      </section>
    </div>
  );
}
