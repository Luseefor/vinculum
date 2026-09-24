"use client";

import { useMemo } from "react";
import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import type { ScalarVizConfig } from "@/types/graphUi";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { MAX_CONTOUR_LEVELS, MIN_CONTOUR_LEVELS } from "@/lib/math/marchingSquares";
import {
  MAX_SCALAR_GRADIENT_DENSITY,
  MIN_SCALAR_GRADIENT_DENSITY
} from "@/lib/math/computeScalarFieldData";
import { MAX_VECTOR_FIELD_SCALE, MIN_VECTOR_FIELD_SCALE } from "@vinculum/scene/defaults";
import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";

interface ScalarVisualizationSectionProps {
  object: SurfaceGraphObject | ImplicitSurfaceObject;
}

// S23 Scalar Visualization (Props tab). Toggles and numeric settings only
// — computed grids live in the result cache. Everything defaults OFF so
// existing scenes never change appearance. Explicit surfaces expose 2D
// heat/contours/gradient layers; implicit surfaces expose a 3D planar
// slice with heat/contours. Sub-controls disclose progressively under
// their master toggle. Diagnostics never mark the source equation
// invalid; gradient-derivative failures isolate to the gradient row.
export default function ScalarVisualizationSection({ object }: ScalarVisualizationSectionProps) {
  const config = useGraphStore((state) => state.ui.scalarVizBySourceId[object.id]);
  const setConfig = useGraphStore((state) => state.setScalarVizConfig);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);
  const fieldStatus = useGeometryComputeStore(
    (state) => state.entries[`scalar:${object.id}`]?.status ?? "idle"
  );
  const sliceStatus = useGeometryComputeStore(
    (state) => state.entries[`slice:${object.id}`]?.status ?? "idle"
  );
  const fieldEntry = useScalarVizResultsStore((state) => state.entries[`scalar:${object.id}`]);
  const sliceEntry = useScalarVizResultsStore((state) => state.entries[`slice:${object.id}`]);

  const isImplicit = object.kind === "implicitSurface";
  const paramKeys = useMemo(() => Object.keys(paramScope), [paramScope]);

  const sourceError = useMemo(() => {
    if (object.kind === "surface") {
      return compileSurfaceExpression(object.equation, object.orientation ?? "z").error;
    }
    return compileImplicitSurfaceExpression(object.equation, paramScope).error;
  }, [object, paramScope]);

  const commit = (patch: Parameters<typeof setConfig>[1]) => {
    setConfig(object.id, patch, scalarVizMathIdentity(object, paramKeys) ?? "");
  };

  const sliceDomainHint = useMemo(() => {
    if (!isImplicit) {
      return null;
    }
    const domain = (object as ImplicitSurfaceObject).domain;
    const plane = config?.slicePlane ?? "xy";
    return plane === "xy"
      ? `z in [${domain.zMin}, ${domain.zMax}]`
      : plane === "xz"
        ? `y in [${domain.yMin}, ${domain.yMax}]`
        : `x in [${domain.xMin}, ${domain.xMax}]`;
  }, [isImplicit, object, config?.slicePlane]);

  return (
    <section
      data-testid="scalar-visualization-section"
      className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3"
    >
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Scalar Visualization</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          {isImplicit
            ? "Planar slice of F(x,y,z) with heat and contours, derived live from the source."
            : "Heat map, contours, and gradient field of f, derived live from the source."}
        </p>
      </header>
      {sourceError && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Fix the source equation to enable scalar visualization.
        </p>
      )}
      {!sourceError && !isImplicit && (
        <ExplicitScalarControls
          config={config}
          fieldEntry={fieldEntry}
          fieldStatus={fieldStatus}
          onCommit={commit}
        />
      )}
      {!sourceError && isImplicit && (
        <ImplicitSliceControls
          config={config}
          sliceEntry={sliceEntry}
          sliceStatus={sliceStatus}
          sliceDomainHint={sliceDomainHint}
          onCommit={commit}
        />
      )}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
      <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        ariaLabel={checked ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      />
    </div>
  );
}

function ExplicitScalarControls({
  config,
  fieldEntry,
  fieldStatus,
  onCommit
}: {
  config: ScalarVizConfig | undefined;
  fieldEntry: ReturnType<typeof useScalarVizResultsStore.getState>["entries"][string] | undefined;
  fieldStatus: "idle" | "pending" | "error";
  onCommit: (patch: {
    showHeatmap?: boolean;
    showContours?: boolean;
    contourCount?: number;
    showGradient?: boolean;
    gradientDensity?: number;
    gradientScale?: number;
    gradientNormalize?: boolean;
  }) => void;
}) {
  const showHeatmap = config?.showHeatmap ?? false;
  const showContours = config?.showContours ?? false;
  const showGradient = config?.showGradient ?? false;
  const result = fieldEntry?.result;
  const legend =
    (showHeatmap || showContours) && result?.status === "ok"
      ? { min: result.min, max: result.max, levels: Array.from(result.levels) }
      : null;
  return (
    <div className="flex flex-col gap-2">
      <ToggleRow label="Heat map" checked={showHeatmap} onChange={(checked) => onCommit({ showHeatmap: checked })} />
      <ToggleRow label="Contours" checked={showContours} onChange={(checked) => onCommit({ showContours: checked })} />
      {showContours && (
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Contour count
          </span>
          <Input
            type="number"
            min={MIN_CONTOUR_LEVELS}
            max={MAX_CONTOUR_LEVELS}
            step="1"
            value={config?.contourCount ?? 8}
            aria-label="Contour count"
            onChange={(event) => {
              const value = Math.floor(Number(event.target.value));
              if (Number.isFinite(value)) {
                onCommit({
                  contourCount: Math.min(MAX_CONTOUR_LEVELS, Math.max(MIN_CONTOUR_LEVELS, value))
                });
              }
            }}
            className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
          />
        </label>
      )}
      <ToggleRow
        label="Gradient field"
        checked={showGradient}
        onChange={(checked) => onCommit({ showGradient: checked })}
      />
      {showGradient && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Gradient density
            </span>
            <Input
              type="number"
              min={MIN_SCALAR_GRADIENT_DENSITY}
              max={MAX_SCALAR_GRADIENT_DENSITY}
              step="1"
              value={config?.gradientDensity ?? 12}
              aria-label="Gradient density"
              onChange={(event) => {
                const value = Math.floor(Number(event.target.value));
                if (Number.isFinite(value)) {
                  onCommit({
                    gradientDensity: Math.min(
                      MAX_SCALAR_GRADIENT_DENSITY,
                      Math.max(MIN_SCALAR_GRADIENT_DENSITY, value)
                    )
                  });
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Gradient scale
            </span>
            <Input
              type="number"
              min={MIN_VECTOR_FIELD_SCALE}
              max={MAX_VECTOR_FIELD_SCALE}
              step="any"
              value={config?.gradientScale ?? 1}
              aria-label="Gradient scale"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  onCommit({
                    gradientScale: Math.min(MAX_VECTOR_FIELD_SCALE, Math.max(MIN_VECTOR_FIELD_SCALE, value))
                  });
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
        </div>
      )}
      {showGradient && (
        <ToggleRow
          label="Normalize gradient"
          checked={config?.gradientNormalize ?? false}
          onChange={(checked) => onCommit({ gradientNormalize: checked })}
        />
      )}
      {fieldStatus === "pending" && (
        <p className="text-[11px] text-[var(--text-tertiary)]" role="status">
          Computing scalar field…
        </p>
      )}
      {legend && (
        <p data-testid="scalar-viz-legend" className="font-mono text-[12px] text-[var(--text-secondary)]" role="status">
          Range [{formatNumber(legend.min)}, {formatNumber(legend.max)}]
          {legend.min < 0 && legend.max > 0 && legend.levels.includes(0) ? " · zero contour included" : ""}
        </p>
      )}
      {result?.status === "empty" && (showHeatmap || showContours || showGradient) && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          No finite values on this grid — nothing to show.
        </p>
      )}
      {result?.status === "ok" && result.contourStatus === "budget-exceeded" && showContours && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Contour result too complex; reduce the contour count.
        </p>
      )}
      {result?.status === "ok" && result.gradientStatus === "unavailable" && showGradient && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Gradient unavailable for this expression. Heat and contours still apply.
        </p>
      )}
      {result?.status === "ok" && result.gradientStatus === "empty" && showGradient && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          No finite gradients on this grid.
        </p>
      )}
    </div>
  );
}

function ImplicitSliceControls({
  config,
  sliceEntry,
  sliceStatus,
  sliceDomainHint,
  onCommit
}: {
  config: ScalarVizConfig | undefined;
  sliceEntry: ReturnType<typeof useScalarVizResultsStore.getState>["entries"][string] | undefined;
  sliceStatus: "idle" | "pending" | "error";
  sliceDomainHint: string | null;
  onCommit: (patch: {
    sliceEnabled?: boolean;
    slicePlane?: "xy" | "xz" | "yz";
    sliceValue?: number;
    showSliceHeatmap?: boolean;
    showSliceContours?: boolean;
  }) => void;
}) {
  const sliceEnabled = config?.sliceEnabled ?? false;
  const result = sliceEntry?.result;
  const legend =
    sliceEnabled && (config?.showSliceHeatmap || config?.showSliceContours) && result?.status === "ok"
      ? { min: result.min, max: result.max, levels: Array.from(result.levels) }
      : null;
  return (
    <div className="flex flex-col gap-2">
      <ToggleRow
        label="Scalar slice"
        checked={sliceEnabled}
        onChange={(checked) => onCommit({ sliceEnabled: checked })}
      />
      {sliceEnabled && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Slice plane
            </span>
            <select
              value={config?.slicePlane ?? "xy"}
              aria-label="Slice plane"
              onChange={(event) => {
                const plane = event.target.value;
                if (plane === "xy" || plane === "xz" || plane === "yz") {
                  onCommit({ slicePlane: plane });
                }
              }}
              className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)]"
            >
              <option value="xy">XY</option>
              <option value="xz">XZ</option>
              <option value="yz">YZ</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Slice value
            </span>
            <Input
              type="number"
              step="any"
              value={config?.sliceValue ?? 0}
              aria-label="Slice value"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) {
                  onCommit({ sliceValue: value });
                }
              }}
              className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
        </div>
      )}
      {sliceEnabled && sliceDomainHint && (
        <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
          Slice value must lie in {sliceDomainHint}.
        </p>
      )}
      {sliceEnabled && (
        <ToggleRow
          label="Heat map"
          checked={config?.showSliceHeatmap ?? true}
          onChange={(checked) => onCommit({ showSliceHeatmap: checked })}
        />
      )}
      {sliceEnabled && (
        <ToggleRow
          label="Contours"
          checked={config?.showSliceContours ?? true}
          onChange={(checked) => onCommit({ showSliceContours: checked })}
        />
      )}
      {sliceStatus === "pending" && sliceEnabled && (
        <p className="text-[11px] text-[var(--text-tertiary)]" role="status">
          Computing scalar slice…
        </p>
      )}
      {legend && (
        <p data-testid="scalar-viz-legend" className="font-mono text-[12px] text-[var(--text-secondary)]" role="status">
          Range [{formatNumber(legend.min)}, {formatNumber(legend.max)}]
          {legend.min < 0 && legend.max > 0 && legend.levels.includes(0) ? " · zero contour included" : ""}
        </p>
      )}
      {result?.status === "empty" && sliceEnabled && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          No finite values on this slice — nothing to show.
        </p>
      )}
      {result?.status === "ok" && result.contourStatus === "budget-exceeded" && config?.showSliceContours && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Contour result too complex; slice a smaller domain.
        </p>
      )}
    </div>
  );
}
