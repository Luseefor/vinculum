"use client";

import type { VectorFieldObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import {
  MAX_STREAMLINE_SEED_DENSITY_2D,
  MAX_STREAMLINE_SEED_DENSITY_3D,
  MIN_STREAMLINE_SEED_DENSITY_2D,
  MIN_STREAMLINE_SEED_DENSITY_3D
} from "@/lib/math/streamlineSeeds";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { getEditorParameterScope } from "@/lib/store/editorParameters";

// S24 Streamlines section (Props tab, vector fields only). Toggle plus
// seed-density / trace-length / quality controls with progressive
// disclosure — everything defaults OFF so existing fields never change
// appearance. Computed polylines live in the result cache; diagnostics
// never mark the source equation invalid. Separate from the S22 pointwise
// section: its Clear action stays pointwise-only (PART 46).
export default function StreamlineSection({ object }: { object: VectorFieldObject }) {
  const config = useGraphStore((state) => state.ui.streamlineVizBySourceId[object.id]);
  const setConfig = useGraphStore((state) => state.setStreamlineConfig);
  const computeStatus = useGeometryComputeStore(
    (state) => state.entries[`streamline:${object.id}`]?.status ?? "idle"
  );
  const computeMessage = useGeometryComputeStore(
    (state) => state.entries[`streamline:${object.id}`]?.message ?? null
  );
  const resultEntry = useStreamlineResultsStore((state) => state.entries[`streamline:${object.id}`]);

  const dimension = object.dimension;
  const field = compileVectorFieldExpressions(
    dimension,
    object.pExpr,
    object.qExpr,
    object.rExpr,
    getEditorParameterScope()
  );

  const commit = (
    patch: Parameters<typeof setConfig>[1] & { dimension?: "2d" | "3d" }
  ) => {
    const params = getEditorParameterScope();
    setConfig(
      object.id,
      { dimension, ...patch },
      vectorCalculusSourceIdentity(object, Object.keys(params)) ?? ""
    );
  };

  const minDensity =
    dimension === "2d" ? MIN_STREAMLINE_SEED_DENSITY_2D : MIN_STREAMLINE_SEED_DENSITY_3D;
  const maxDensity =
    dimension === "2d" ? MAX_STREAMLINE_SEED_DENSITY_2D : MAX_STREAMLINE_SEED_DENSITY_3D;
  const result = resultEntry?.result;

  return (
    <section
      data-testid="streamline-section"
      className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3"
    >
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Streamlines</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Curves tangent to the vector field.
        </p>
      </header>
      {field.error ? (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Fix the component expressions to enable streamlines.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
            <span className="text-[12px] text-[var(--text-secondary)]">Show streamlines</span>
            <Switch
              checked={config?.enabled ?? false}
              onCheckedChange={(checked) => commit({ enabled: checked })}
              ariaLabel={(config?.enabled ?? false) ? "Hide streamlines" : "Show streamlines"}
            />
          </div>
          {(config?.enabled ?? false) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Seed density
                  </span>
                  <Input
                    type="number"
                    min={minDensity}
                    max={maxDensity}
                    step="1"
                    value={config?.seedDensity ?? (dimension === "2d" ? 6 : 3)}
                    aria-label="Seed density"
                    onChange={(event) => {
                      const value = Math.floor(Number(event.target.value));
                      if (Number.isFinite(value)) {
                        commit({
                          seedDensity: Math.min(maxDensity, Math.max(minDensity, value))
                        });
                      }
                    }}
                    className="h-8 rounded-[6px] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Trace length
                  </span>
                  <select
                    value={config?.length ?? "medium"}
                    aria-label="Trace length"
                    onChange={(event) => {
                      const length = event.target.value;
                      if (length === "short" || length === "medium" || length === "long") {
                        commit({ length });
                      }
                    }}
                    className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)]"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                  Quality
                </span>
                <select
                  value={config?.quality ?? "medium"}
                  aria-label="Quality"
                  onChange={(event) => {
                    const quality = event.target.value;
                    if (quality === "low" || quality === "medium" || quality === "high") {
                      commit({ quality });
                    }
                  }}
                  className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </>
          )}
          {computeStatus === "pending" && (config?.enabled ?? false) && (
            <p className="text-[11px] text-[var(--text-tertiary)]" role="status">
              Computing streamlines…
            </p>
          )}
          {result?.status === "ok" && (config?.enabled ?? false) && (
            <p data-testid="streamline-count" className="font-mono text-[12px] text-[var(--text-secondary)]" role="status">
              {result.streamlineCount} {result.streamlineCount === 1 ? "curve" : "curves"} ·{" "}
              {result.totalPoints} points
            </p>
          )}
          {result?.status === "empty" && (config?.enabled ?? false) && (
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
              No streamlines here — the field is zero or invalid on every seed.
            </p>
          )}
          {computeStatus === "error" && (config?.enabled ?? false) && (
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
              {computeMessage ?? "Streamline computation failed; edit to retry."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
