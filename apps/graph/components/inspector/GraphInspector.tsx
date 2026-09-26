"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import DifferentialAnalysisSection from "./DifferentialAnalysisSection";
import GeometryAnalysisSection from "./GeometryAnalysisSection";
import GeometryPrimitiveInspector from "./GeometryPrimitiveInspector";
import LinearTransformInspector from "./LinearTransformInspector";
import IntegralAnalysisSection from "./IntegralAnalysisSection";
import ScalarVisualizationSection from "./ScalarVisualizationSection";
import type { GraphObject, ImplicitSurfaceObject, LineObject, ParametricCurveObject, ParametricSurfaceObject, PointObject, RayObject, SegmentObject, SurfaceGraphObject, VectorFieldObject, VectorObject } from "@vinculum/scene/types";
import {
  MAX_VECTOR_FIELD_2D_DENSITY,
  MAX_VECTOR_FIELD_3D_DENSITY,
  MIN_VECTOR_FIELD_DENSITY
} from "@vinculum/scene/defaults";
import { useGraphStore } from "@/store/graphStore";
import DomainSection from "./DomainSection";
import VectorCalculusSection from "./VectorCalculusSection";
import StreamlineSection from "./StreamlineSection";

export default function GraphInspector() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);

  const selectedObject = useMemo<GraphObject | null>(
    () => objects.find((object) => object.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  if (!selectedObject) {
    return (
      <div id="graph-inspector" className="rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-transparent px-3 py-4 text-center shadow-none">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to edit its properties.</p>
      </div>
    );
  }

  if (selectedObject.kind === "parametricCurve") {
    return (
      <section id="graph-inspector">
        <ParametricCurveInspector object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "parametricSurface") {
    return (
      <section id="graph-inspector">
        <ParametricSurfaceInspector object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "implicitSurface") {
    return (
      <section id="graph-inspector">
        <ImplicitSurfaceInspector object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "plane") {
    return (
      <section id="graph-inspector">
        <PlaneInspector />
        <div className="mt-3">
          <GeometryAnalysisSection key={selectedObject.id} object={selectedObject} />
        </div>
      </section>
    );
  }

  if (selectedObject.kind === "linearTransform") {
    return (
      <section id="graph-inspector">
        <LinearTransformInspector object={selectedObject} />
      </section>
    );
  }

  // S20: full field inspector — sampling box, density, and appearance
  // hints. Scale/normalize/color live under the Styles tab.
  if (selectedObject.kind === "vectorField") {
    return (
      <section id="graph-inspector">
        <VectorFieldInspector object={selectedObject} objects={objects} />
      </section>
    );
  }

  // S26/S27: geometric primitives share one compact inspector
  // (definition editor only — no analysis sections; integral targets stay
  // curve/surface-only by construction below).
  if (
    selectedObject.kind === "point" ||
    selectedObject.kind === "vector" ||
    selectedObject.kind === "line" ||
    selectedObject.kind === "ray" ||
    selectedObject.kind === "segment"
  ) {
    const primitive: PointObject | VectorObject | LineObject | RayObject | SegmentObject = selectedObject;
    const primitiveIndex = objects.findIndex((candidate) => candidate.id === primitive.id);
    return (
      <section id="graph-inspector">
        <GeometryPrimitiveInspector key={primitive.id} object={primitive} index={primitiveIndex} />
        <div className="mt-3">
          <GeometryAnalysisSection key={`analysis-${primitive.id}`} object={primitive} />
        </div>
      </section>
    );
  }

  const selectedSurfaceObject: SurfaceGraphObject = selectedObject;
  const selectedIndex = objects.findIndex((object) => object.id === selectedSurfaceObject.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";

  return (
    <section id="graph-inspector" className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
      <div className="mb-2 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedSurfaceObject.color }} />
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Surface {selectedTitle}</h3>
        </div>
        <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          surface
        </span>
      </div>

      <p className="mb-2 px-0.5 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
        Tessellation, color, and wireframe are in the <span className="font-semibold text-[var(--text-secondary)]">Styles</span> tab.
      </p>

      <DomainSection object={selectedSurfaceObject} />
      <div className="mt-3">
        <DifferentialAnalysisSection object={selectedSurfaceObject} />
      </div>
      <div className="mt-3">
        <ScalarVisualizationSection object={selectedSurfaceObject} />
      </div>
      <div className="mt-3">
        <IntegralAnalysisSection key={selectedSurfaceObject.id} object={selectedSurfaceObject} />
      </div>
    </section>
  );
}

function VectorFieldInspector({ object, objects }: { object: VectorFieldObject; objects: GraphObject[] }) {
  const updateVectorFieldExpression = useGraphStore((state) => state.updateVectorFieldExpression);
  const selectedIndex = objects.findIndex((candidate) => candidate.id === object.id);
  const selectedTitle = selectedIndex >= 0 ? `#${selectedIndex + 1}` : "";
  const coords = object.dimension === "2d" ? "x,y" : "x,y,z";

  const rangeFields =
    object.dimension === "3d"
      ? [
          { key: "xMin" as const, label: "x min" },
          { key: "xMax" as const, label: "x max" },
          { key: "yMin" as const, label: "y min" },
          { key: "yMax" as const, label: "y max" },
          { key: "zMin" as const, label: "z min" },
          { key: "zMax" as const, label: "z max" }
        ]
      : [
          { key: "xMin" as const, label: "x min" },
          { key: "xMax" as const, label: "x max" },
          { key: "yMin" as const, label: "y min" },
          { key: "yMax" as const, label: "y max" }
        ];

  const densityMax = object.dimension === "2d" ? MAX_VECTOR_FIELD_2D_DENSITY : MAX_VECTOR_FIELD_3D_DENSITY;

  const readDomain = (key: "xMin" | "xMax" | "yMin" | "yMax" | "zMin" | "zMax"): number => {
    if (object.dimension === "2d") {
      // Unreachable: 2D grids omit z keys by construction above.
      if (key === "zMin" || key === "zMax") {
        return 0;
      }
      return object.domain[key];
    }
    return object.domain[key];
  };

  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header className="pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: object.color }} />
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">
            Vector Field {selectedTitle}
          </h3>
          <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {object.dimension === "2d" ? "2D field" : "3D field"}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Edit P, Q{object.dimension === "3d" ? ", R" : ""} in the list. The sampling domain and
          density define the fixed mathematical grid ({object.dimension === "2d" ? "2D" : "3D"} fields
          sample F({coords}) on a bounded lattice).
        </p>
      </header>
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Sampling domain
        </h4>
        <div className="grid grid-cols-2 gap-2.5">
          {rangeFields.map((entry) => (
            <label key={entry.key} className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {entry.label}
              </span>
              <Input
                type="number"
                value={readDomain(entry.key)}
                step="any"
                aria-label={entry.label}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (Number.isFinite(v)) {
                    updateVectorFieldExpression(object.id, entry.key, v);
                  }
                }}
                className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Density per axis ({MIN_VECTOR_FIELD_DENSITY}-{densityMax})
          </span>
          <Input
            type="number"
            min={MIN_VECTOR_FIELD_DENSITY}
            max={densityMax}
            value={object.density}
            aria-label="Density"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateVectorFieldExpression(object.id, "density", v);
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </div>
      <div className="mt-3">
        <VectorCalculusSection object={object} />
      </div>
      <div className="mt-3">
        <StreamlineSection object={object} />
      </div>
    </section>
  );
}

function ParametricCurveInspector({ object }: { object: ParametricCurveObject }) {  const updateParametricExpression = useGraphStore((state) => state.updateParametricExpression);

  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header className="pb-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Curve</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Edit x(t), y(t), z(t) in the list. Domain and sample count apply to both 2D and 3D views.
        </p>
      </header>
      <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Parameter range</h4>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">t min</span>
          <Input
            type="number"
            value={object.tMin}
            step="any"
            aria-label="t min"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMin", v);
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">t max</span>
          <Input
            type="number"
            value={object.tMax}
            step="any"
            aria-label="t max"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricExpression(object.id, "tMax", v);
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </div>
      <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Samples</span>
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
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </div>
      <div className="mt-3">
        <IntegralAnalysisSection key={object.id} object={object} />
      </div>
    </section>
  );
}

function ParametricSurfaceInspector({ object }: { object: ParametricSurfaceObject }) {
  const updateParametricSurfaceExpression = useGraphStore((state) => state.updateParametricSurfaceExpression);

  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header className="pb-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Parametric Surface</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Edit x(u,v), y(u,v), z(u,v) in the list. Parameter ranges and resolution apply to the 3D views.
        </p>
      </header>
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Parameter ranges</h4>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">u min</span>
            <Input
              type="number"
              value={object.domain.uMin}
              step="any"
              aria-label="u min"
              onChange={(event) => {
                const v = Number(event.target.value);
                if (Number.isFinite(v)) {
                  updateParametricSurfaceExpression(object.id, "uMin", v);
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">u max</span>
            <Input
              type="number"
              value={object.domain.uMax}
              step="any"
              aria-label="u max"
              onChange={(event) => {
                const v = Number(event.target.value);
                if (Number.isFinite(v)) {
                  updateParametricSurfaceExpression(object.id, "uMax", v);
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">v min</span>
            <Input
              type="number"
              value={object.domain.vMin}
              step="any"
              aria-label="v min"
              onChange={(event) => {
                const v = Number(event.target.value);
                if (Number.isFinite(v)) {
                  updateParametricSurfaceExpression(object.id, "vMin", v);
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">v max</span>
            <Input
              type="number"
              value={object.domain.vMax}
              step="any"
              aria-label="v max"
              onChange={(event) => {
                const v = Number(event.target.value);
                if (Number.isFinite(v)) {
                  updateParametricSurfaceExpression(object.id, "vMax", v);
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Resolution</span>
          <Input
            type="number"
            min={2}
            value={object.resolution}
            aria-label="Resolution"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateParametricSurfaceExpression(object.id, "resolution", v);
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </div>
      <div className="mt-3">
        <IntegralAnalysisSection key={object.id} object={object} />
      </div>
    </section>
  );
}

function ImplicitSurfaceInspector({ object }: { object: ImplicitSurfaceObject }) {
  const updateImplicitSurfaceExpression = useGraphStore((state) => state.updateImplicitSurfaceExpression);

  const rangeFields = [
    { key: "xMin" as const, label: "x min" },
    { key: "xMax" as const, label: "x max" },
    { key: "yMin" as const, label: "y min" },
    { key: "yMax" as const, label: "y max" },
    { key: "zMin" as const, label: "z min" },
    { key: "zMax" as const, label: "z max" }
  ];

  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header className="pb-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Implicit Surface</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Edit F(x,y,z) = 0 in the list, either as a bare field or as an equality. The sampling box and
          resolution apply to the 3D views.
        </p>
      </header>
      <div>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Sampling box</h4>
        <div className="grid grid-cols-2 gap-2.5">
          {rangeFields.map((entry) => (
            <label key={entry.key} className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {entry.label}
              </span>
              <Input
                type="number"
                value={object.domain[entry.key]}
                step="any"
                aria-label={entry.label}
                onChange={(event) => {
                  const v = Number(event.target.value);
                  if (Number.isFinite(v)) {
                    updateImplicitSurfaceExpression(object.id, entry.key, v);
                  }
                }}
                className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Resolution</span>
          <Input
            type="number"
            min={2}
            value={object.resolution}
            aria-label="Resolution"
            onChange={(event) => {
              const v = Number(event.target.value);
              if (Number.isFinite(v)) {
                updateImplicitSurfaceExpression(object.id, "resolution", v);
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      </div>
      <div className="mt-3">
        <DifferentialAnalysisSection object={object} />
      </div>
      <div className="mt-3">
        <ScalarVisualizationSection object={object} />
      </div>
    </section>
  );
}

function PlaneInspector() {  return (
    <section className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3">
      <header className="pb-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Plane</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Edit the plane equation in the list. 2D view shows the intersection with the axis plane you chose in the
          toolbar. Color and wireframe live under the Styles tab.
        </p>
      </header>
    </section>
  );
}
