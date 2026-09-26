// S30 Analyze tab: every mathematically relevant analysis for the selected
// object, ordered fundamental → advanced. Only capabilities relevant to the
// selected kind render here — the tab never lists all Vinculum features.
//
// Per-kind order:
// - explicit surface: Differential, Scalar Visualization, Integral
// - vector field: Vector Calculus, Streamlines
// - parametric curve/surface: Integral
// - implicit surface: Differential, Scalar Visualization
// - plane/primitives: Geometry Analysis
// - linear transform: Properties, Apply to Vector, Eigendirections

"use client";

import DifferentialAnalysisSection from "./DifferentialAnalysisSection";
import GeometryAnalysisSection from "./GeometryAnalysisSection";
import LinearTransformInspector from "./LinearTransformInspector";
import IntegralAnalysisSection from "./IntegralAnalysisSection";
import ScalarVisualizationSection from "./ScalarVisualizationSection";
import VectorCalculusSection from "./VectorCalculusSection";
import StreamlineSection from "./StreamlineSection";
import { useSelectedGraphObject } from "./ObjectInspector";

export default function AnalysisInspector() {
  const selectedObject = useSelectedGraphObject();

  if (!selectedObject) {
    return (
      <div id="graph-inspector" className="rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-transparent px-3 py-4 text-center shadow-none">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">No selection</p>
        <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">Select an object to analyze it.</p>
      </div>
    );
  }

  if (selectedObject.kind === "parametricCurve") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <IntegralAnalysisSection key={selectedObject.id} object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "parametricSurface") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <IntegralAnalysisSection key={selectedObject.id} object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "implicitSurface") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <DifferentialAnalysisSection object={selectedObject} />
        <ScalarVisualizationSection object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "plane") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <GeometryAnalysisSection key={selectedObject.id} object={selectedObject} />
      </section>
    );
  }

  if (selectedObject.kind === "linearTransform") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <LinearTransformInspector object={selectedObject} section="analysis" />
      </section>
    );
  }

  if (selectedObject.kind === "vectorField") {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <VectorCalculusSection object={selectedObject} />
        <StreamlineSection object={selectedObject} />
      </section>
    );
  }

  if (
    selectedObject.kind === "point" ||
    selectedObject.kind === "vector" ||
    selectedObject.kind === "line" ||
    selectedObject.kind === "ray" ||
    selectedObject.kind === "segment"
  ) {
    return (
      <section id="graph-inspector" className="flex flex-col gap-3">
        <GeometryAnalysisSection key={`analysis-${selectedObject.id}`} object={selectedObject} />
      </section>
    );
  }

  return (
    <section id="graph-inspector" className="flex flex-col gap-3">
      <DifferentialAnalysisSection object={selectedObject} />
      <ScalarVisualizationSection object={selectedObject} />
      <IntegralAnalysisSection key={selectedObject.id} object={selectedObject} />
    </section>
  );
}
