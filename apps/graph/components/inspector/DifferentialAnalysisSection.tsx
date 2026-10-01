"use client";

import { useEffect, useMemo, useState } from "react";
import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGeometryComputeStore, type GeometryComputeStatus } from "@/lib/compute/geometryComputeStatus";import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { resolveAnalysisSectionModel } from "./differentialAnalysisSectionModel";
import { computeDirectionalDerivative, type SurfaceGradient } from "@/lib/math/surfaceDifferential";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

interface DifferentialAnalysisSectionProps {
  object: SurfaceGraphObject | ImplicitSurfaceObject;
}

// S21 contextual analysis section (Props tab, supported surfaces only).
// Reads the transient source-attached record, derives values through the
// same pure computeSurfaceAnalysis the overlay sync uses, and never stores
// computed numbers. Empty state shows one clear Pick action; failure modes
// are compact diagnostics (never expression-syntax styling, never rows of
// zeroes, and never marks the source equation invalid).
export default function DifferentialAnalysisSection({ object }: DifferentialAnalysisSectionProps) {
  const record = useGraphStore((state) => state.ui.differentialAnalysisBySourceId[object.id]);
  const armed = useGraphStore((state) => state.ui.differentialAnalysisPickArmedId === object.id);
  const armPick = useGraphStore((state) => state.armDifferentialAnalysisPick);
  const setOverlays = useGraphStore((state) => state.setDifferentialAnalysisOverlays);
  const clearAnalysis = useGraphStore((state) => state.clearDifferentialAnalysis);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const viewportMode = useEditorStore((state) => state.viewportMode);
  const computeStatus = useGeometryComputeStore(
    (state): GeometryComputeStatus => state.entries[object.id]?.status ?? "idle"
  );

  const canPick3D =
    viewportMode === "split" || viewportMode === "quad" || graphMode !== "2d";

  const model = useMemo(
    () => resolveAnalysisSectionModel({ object, record, computeStatus }),
    [object, record, computeStatus]
  );

  // Self-heal when no engine tick runs (e.g. equation edited in 2D-only
  // mode): a stale record clears from the section itself.
  useEffect(() => {
    if (model.stale) {
      clearAnalysis(object.id);
    }
  }, [model.stale, object.id, clearAnalysis]);

  return (
    <section className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0">
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Differential Analysis</h3>
      </header>
      {model.body === "empty" && (
        <div>
          <p className="mb-2 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
            {armed ? "Click on the surface to set the analysis point." : "Pick a point on the surface."}
          </p>
          <button
            type="button"
            onClick={() => armPick(armed ? null : object.id)}
            disabled={!armed && (!model.pickEnabled || !canPick3D || computeStatus !== "idle")}
            title={
              !model.pickEnabled
                ? "Fix the source equation first"
                : !canPick3D
                  ? "Switch to a 3D view to pick a point"
                  : computeStatus !== "idle"
                    ? "Computing source…"
                    : armed
                      ? "Cancel picking"
                      : "Pick a point on the surface"
            }
            aria-label={armed ? "Cancel picking analysis point" : "Pick analysis point on surface"}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {armed ? "Cancel" : "Pick point"}
          </button>
          {!armed && computeStatus !== "idle" && (
            <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">Computing source…</p>
          )}
        </div>
      )}
      {model.body === "pending" && (
        <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Source updating — analysis resumes when the new surface settles.
        </p>
      )}
      {model.body === "values" && (
        <div className="flex flex-col gap-2.5" role="status" aria-label="Differential analysis results">
          <p className="font-mono text-[12px] text-[var(--text-secondary)]">
            P = ({formatNumber(model.point.x)}, {formatNumber(model.point.y)}, {formatNumber(model.point.z)})
          </p>
          <p className="font-mono text-[12px] text-[var(--text-secondary)]">
            {/* S32: preserve the S21/S22 mathematical distinction — explicit
                surfaces show the function gradient, implicit surfaces the
                level-set normal. Never merge both under one "Gradient" label. */}
            {object.kind === "surface" ? "Function gradient = " : "Level-set normal = "}&lt;{formatNumber(model.gradient.x)}, {formatNumber(model.gradient.y)},{" "}
            {formatNumber(model.gradient.z)}&gt;
          </p>
          <p className="break-words font-mono text-[12px] text-[var(--text-secondary)]">
            Tangent: {formatPlaneEquation(model.gradient, model.point)}
          </p>
          {object.kind === "surface" && (
            <DirectionalDerivativeBlock key={object.id} object={object} point={model.point} />
          )}
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-[var(--text-secondary)]">Show normal</span>
            <Switch
              checked={model.showNormal}
              onCheckedChange={(checked) => setOverlays(object.id, { showNormal: checked })}
              ariaLabel={model.showNormal ? "Hide normal arrow" : "Show normal arrow"}
            />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[12px] text-[var(--text-secondary)]">Show tangent plane</span>
            <Switch
              checked={model.showTangent}
              onCheckedChange={(checked) => setOverlays(object.id, { showTangent: checked })}
              ariaLabel={model.showTangent ? "Hide tangent plane" : "Show tangent plane"}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => armPick(object.id)}
              aria-label="Pick a new analysis point"
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              Re-pick
            </button>
            <button
              type="button"
              onClick={() => clearAnalysis(object.id)}
              aria-label="Clear differential analysis"
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      {model.body === "diagnostic" && (
        <div>
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
            {model.message}
          </p>
          {model.repick && (
            <button
              type="button"
              onClick={() => armPick(object.id)}
              aria-label="Pick analysis point on surface"
              className="mt-2 h-8 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            >
              Pick point
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// S22 directional derivative for explicit surfaces only (PART 14/16).
// D_u f = ∇f · û where ∇f is the scalar-function gradient in independent
// variables — distinct from the level-set normal above. Direction inputs
// use independent-variable components, normalize internally, and change
// zero worker jobs (pure re-evaluation). Zero direction is a compact
// diagnostic, never NaN.
function DirectionalDerivativeBlock({
  object,
  point
}: {
  object: SurfaceGraphObject;
  point: { x: number; y: number; z: number };
}) {
  const stored = useGraphStore((state) => state.ui.directionInputBySourceId[object.id]);
  const setDirectionInput = useGraphStore((state) => state.setDirectionInput);
  const editorParameters = useEditorStore((state) => state.parameters);
  const [drafts, setDrafts] = useState<{ u?: string; v?: string }>({});

  const orientation = object.orientation ?? "z";
  const vars: [string, string] =
    orientation === "x" ? ["y", "z"] : orientation === "y" ? ["x", "z"] : ["x", "y"];

  const direction = stored ?? { u: NaN, v: NaN };
  const hasDirection = Number.isFinite(direction.u) && Number.isFinite(direction.v);

  const outcome = useMemo(() => {
    if (!hasDirection) {
      return null;
    }
    return computeDirectionalDerivative(object, point, getEditorParameterScope(), {
      u: direction.u,
      v: direction.v
    });
    // Recompute on direction, point, source equation/orientation, and
    // parameter values (live recompute, no invalidation needed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.equation, orientation, point.x, point.y, point.z, direction.u, direction.v, editorParameters]);

  const commit = (key: "u" | "v", raw: string) => {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) {
      return;
    }
    const next = {
      u: key === "u" ? value : (stored?.u ?? 0),
      v: key === "v" ? value : (stored?.v ?? 0)
    };
    if (key !== "u" && !Number.isFinite(stored?.u)) {
      next.u = 0;
    }
    if (key !== "v" && !Number.isFinite(stored?.v)) {
      next.v = 0;
    }
    setDirectionInput(object.id, next);
  };

  return (
    <div data-testid="directional-derivative" className="flex flex-col gap-2 py-1">
      <p className="text-[11px] font-medium text-[var(--text-tertiary)]">
        Directional derivative
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["u", "v"] as const).map((key, index) => (
          <label key={key} className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              d{vars[index]}
            </span>
            <Input
              type="number"
              step="any"
              value={drafts[key] ?? (Number.isFinite(direction[key]) ? String(direction[key]) : "")}
              aria-label={`Direction ${vars[index]}`}
              onChange={(event) => {
                const next = event.target.value;
                setDrafts((prev) => ({ ...prev, [key]: next }));
                if (next.trim() !== "" && Number.isFinite(Number(next))) {
                  commit(key, next);
                }
              }}
              onBlur={() => setDrafts((prev) => ({ ...prev, [key]: undefined }))}
              className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
        ))}
      </div>
      {!hasDirection && (
        <p className="text-[11px] leading-snug text-[var(--text-tertiary)]">
          Enter a direction in ({vars[0]}, {vars[1]}).
        </p>
      )}
      {outcome !== null && outcome.status === "ok" && (
        <div className="flex flex-col gap-1" role="status" aria-label="Directional derivative result">
          <p className="font-mono text-[12px] text-[var(--text-secondary)]">
            Function gradient (direction of maximum increase) = &lt;{formatNumber(outcome.gradient.g1)},{" "}
            {formatNumber(outcome.gradient.g2)}&gt;
          </p>
          <p className="font-mono text-[12px] text-[var(--text-secondary)]">
            Unit direction = &lt;{formatNumber(outcome.unitDirection.u)}, {formatNumber(outcome.unitDirection.v)}&gt;
          </p>
          <p data-testid="directional-derivative-value" className="font-mono text-[12px] text-[var(--text-secondary)]">
            D = {formatNumber(outcome.value)}
          </p>
        </div>
      )}
      {outcome !== null && outcome.status === "zero-direction" && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Direction must be nonzero.
        </p>
      )}
      {outcome !== null && outcome.status === "derivative-unavailable" && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Directional derivative unavailable for this expression.
        </p>
      )}
      {outcome !== null && outcome.status === "non-finite" && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Derivatives are not finite at this point.
        </p>
      )}
      {outcome !== null && outcome.status === "invalid-source" && (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Fix the source equation to enable directional derivatives.
        </p>
      )}
    </div>
  );
}

function formatPlaneEquation(
  gradient: SurfaceGradient,
  point: { x: number; y: number; z: number }
): string {
  // Sub-epsilon coefficients vanish from display (consistent with the
  // zero-gradient threshold: below 1e-12 a component IS zero for S21).
  const terms: Array<{ coef: number; variable: string; origin: number }> = [
    { coef: gradient.x, variable: "x", origin: point.x },
    { coef: gradient.y, variable: "y", origin: point.y },
    { coef: gradient.z, variable: "z", origin: point.z }
  ].filter((term) => Math.abs(term.coef) >= 1e-12);
  if (terms.length === 0) {
    return "0 = 0";
  }
  const rendered = terms.map((term, index) => {
    const magnitude = Math.abs(term.coef);
    const coefText = magnitude === 1 ? "" : formatNumber(magnitude);
    const sign = term.coef < 0 ? "-" : index === 0 ? "" : "+";
    const spacer = index === 0 ? "" : " ";
    return `${sign}${spacer}${coefText}(${term.variable} - ${formatNumber(term.origin)})`;
  });
  return `${rendered.join(" ")} = 0`;
}
