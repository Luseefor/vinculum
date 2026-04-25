"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GraphObject, ParametricCurveObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
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
      <Card id="graph-inspector" className="border-dashed border-[var(--border-subtle)] bg-[var(--surface-overlay)]/20 px-4 py-8 text-center shadow-none">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Select an object to edit its properties.</p>
      </Card>
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
        <PlaneInspector />
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";

  return (
    <Card id="graph-inspector" className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-2 shadow-sm">
      <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedSurfaceObject.color }} />
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Surface {selectedTitle}</h3>
        </div>
        <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--text-tertiary)]">
          surface
        </span>
      </div>

      <p className="mb-2 px-0.5 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
        Tessellation, color, and wireframe are in the <span className="font-semibold text-[var(--text-secondary)]">Styles</span> tab.
      </p>

      <DomainSection object={selectedSurfaceObject} />
    </Card>
  );
}

function ParametricCurveInspector({ object }: { object: ParametricCurveObject }) {
  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);

  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="pb-3">
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Curve</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Edit x(t), y(t), z(t) in the list. Domain and sample count apply to both 2D and 3D views.
        </p>
      </CardHeader>
      <CardContent>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Parameter range</h4>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">t min</span>
          <Input
            type="number"
            value={object.tMin}
            step="any"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMin", v);
              }
            }}
            className="h-8 rounded border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">t max</span>
          <Input
            type="number"
            value={object.tMax}
            step="any"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMax", v);
              }
            }}
            className="h-8 rounded border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 text-[12px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-medium text-[var(--text-secondary)]">Samples</span>
        <Input
          type="number"
          min={2}
          value={object.samples}
          onChange={(event) => {
            const v = Number(event.target.value);
            if (Number.isFinite(v)) {
              updateParametricExpression(object.id, "samples", v);
            }
          }}
          className="h-8 rounded border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 text-[12px]"
        />
      </label>
      </CardContent>
    </Card>
  );
}

function PlaneInspector() {
  return (
    <Card className="border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 shadow-sm">
      <CardHeader className="pb-3">
        <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Plane</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Edit the plane equation in the list. 2D view shows the intersection with the axis plane you chose in the
          toolbar. Color and wireframe live under the Styles tab.
        </p>
      </CardHeader>
    </Card>
  );
}
