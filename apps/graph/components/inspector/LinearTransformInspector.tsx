// S28 Linear Transformation inspector: matrix grid editor, live
// properties (det/trace/rank/invertible/inverse/orientation/scale),
// vector application, and eigen analysis. Everything computes
// synchronously from live sources every render — nothing cached, so
// parameters, undo/redo, and workspace switches never show stale math.

"use client";

import { useMemo } from "react";
import type { GraphObject, LinearTransformObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { Switch } from "@/components/ui/switch";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import MatrixEntryEditor from "@/components/objects/MatrixEntryEditor";
import { resolveVectorGeometry } from "@/lib/math/geometryResolve";
import {
  orientationOfDeterminant,
  resolveLinearTransform,
  type ResolvedTransform
} from "@/lib/math/linearTransformResolve";
import {
  determinant2,
  determinant3,
  inverse2,
  inverse3,
  isSingular,
  matrixRank,
  matrixVectorMultiply2,
  matrixVectorMultiply3,
  trace2,
  trace3
} from "@/lib/math/matrix";
import { analyzeEigen, formatComplexValue } from "@/lib/math/matrixEigen";

function FactRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      <span data-testid={testId} className="font-mono text-[12px] text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function formatTuple(values: number[]): string {
  return `<${values.map((value) => formatNumber(value)).join(", ")}>`;
}

export default function LinearTransformInspector({ object }: { object: LinearTransformObject }) {
  const objects = useGraphStore((state) => state.scene.objects);
  const setObjectKind = useGraphStore((state) => state.setObjectKind);
  const analysis = useGraphStore((state) => state.ui.linearTransformAnalysisBySourceId[object.id]);
  const setLinearTransformAnalysis = useGraphStore((state) => state.setLinearTransformAnalysis);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);
  const selectedIndex = objects.findIndex((candidate) => candidate.id === object.id);

  const resolved = useMemo<ResolvedTransform>(
    () => resolveLinearTransform({ dimension: object.dimension, entries: entryMapOf(object) }, paramScope),
    [object, paramScope]
  );

  const properties = useMemo(() => {
    if (resolved.status !== "ok") {
      return null;
    }
    if (resolved.dimension === 2) {
      const det = determinant2(resolved.matrix);
      const singular = isSingular(resolved.matrix, 2, det);
      return {
        determinant: det,
        trace: trace2(resolved.matrix),
        rank: matrixRank(resolved.matrix, 2),
        singular,
        inverse: singular ? null : inverse2(resolved.matrix),
        scale: Math.abs(det),
        scaleLabel: "Area scale",
        orientation: orientationOfDeterminant(det, singular)
      };
    }
    const det = determinant3(resolved.matrix);
    const singular = isSingular(resolved.matrix, 3, det);
    return {
      determinant: det,
      trace: trace3(resolved.matrix),
      rank: matrixRank(resolved.matrix, 3),
      singular,
      inverse: singular ? null : inverse3(resolved.matrix),
      scale: Math.abs(det),
      scaleLabel: "Volume scale",
      orientation: orientationOfDeterminant(det, singular)
    };
  }, [resolved]);

  const eigen = useMemo(() => {
    if (resolved.status !== "ok") {
      return null;
    }
    return analyzeEigen([...resolved.matrix], resolved.dimension);
  }, [resolved]);

  const vectorOptions = useMemo(
    () => objects.filter((candidate): candidate is Extract<GraphObject, { kind: "vector" }> => candidate.kind === "vector"),
    [objects]
  );
  const selectedVector = analysis?.vectorId
    ? (objects.find((candidate) => candidate.id === analysis.vectorId) ?? null)
    : null;

  const appliedVector = useMemo(() => {
    if (resolved.status !== "ok" || !selectedVector || selectedVector.kind !== "vector") {
      return null;
    }
    const vector = resolveVectorGeometry(
      [selectedVector.oxExpr, selectedVector.oyExpr, selectedVector.ozExpr],
      [selectedVector.vxExpr, selectedVector.vyExpr, selectedVector.vzExpr],
      paramScope
    );
    if (vector.status !== "ok") {
      return { error: vector.reason as string };
    }
    // Components multiply; origin anchors the comparison (PART 19).
    // 2D transforms act on XY with z passing through (documented).
    const components = vector.value.vector;
    const product =
      resolved.dimension === 2
        ? (() => {
            const [x, y] = matrixVectorMultiply2(resolved.matrix, [components.x, components.y]);
            return { x, y, z: components.z };
          })()
        : matrixVectorMultiply3(resolved.matrix, components);
    return {
      origin: vector.value.origin,
      components,
      product
    };
  }, [resolved, selectedVector, paramScope]);

  return (
    <div className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
      <div className="mb-2 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5">        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: object.color }} />
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
            Linear Transformation{selectedIndex >= 0 ? ` #${selectedIndex + 1}` : ""}
          </h3>
        </div>
        <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {object.dimension === "2d" ? "2D" : "3D"}
        </span>
      </div>

      <MatrixEntryEditor object={object} />

      <div className="mt-2 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5">
        <label htmlFor={`linear-transform-dimension-${object.id}`} className="text-[12px] text-[var(--text-secondary)]">
          Dimension
        </label>
        <select
          id={`linear-transform-dimension-${object.id}`}
          aria-label="Transformation dimension"
          value={object.dimension}
          onChange={(event) => {
            const dimension = event.target.value;
            if (dimension === "2d" || dimension === "3d") {
              setObjectKind(object.id, "linearTransform", dimension);
            }
          }}
          className="h-8 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 text-[13px] text-[var(--text-primary)]"
        >
          <option value="2d">2D</option>
          <option value="3d">3D</option>
        </select>
      </div>

      <div className="mt-3 flex flex-col gap-1" role="status" aria-label="Transformation properties">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Properties</h4>
        {resolved.status !== "ok" || !properties ? (
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {resolved.status !== "ok" ? resolved.reason : "Properties unavailable."}
          </p>
        ) : (
          <>
            <FactRow label="Determinant" value={formatNumber(properties.determinant)} testId="linear-fact-determinant" />
            <FactRow label="Trace" value={formatNumber(properties.trace)} testId="linear-fact-trace" />
            <FactRow label="Rank" value={`${properties.rank}`} testId="linear-fact-rank" />
            <FactRow
              label="Invertible"
              value={properties.singular ? "No" : "Yes"}
              testId="linear-fact-invertible"
            />
            <FactRow label={properties.scaleLabel} value={formatNumber(properties.scale)} testId="linear-fact-scale" />
            <FactRow
              label="Orientation"
              value={
                properties.orientation === "preserved"
                  ? "Preserved"
                  : properties.orientation === "reversed"
                    ? "Reversed"
                    : "Collapsed / singular"
              }
              testId="linear-fact-orientation"
            />
            {properties.inverse ? (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-[var(--text-secondary)]">Inverse</span>
                <span data-testid="linear-fact-inverse" className="font-mono text-[12px] text-[var(--text-primary)]">
                  {formatMatrixText(properties.inverse, resolved.dimension)}
                </span>
              </div>
            ) : (
              <FactRow label="Inverse" value="Numerically singular / inverse unavailable" />
            )}
          </>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Apply to Vector
        </h4>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Vector
          </span>
          <select
            value={analysis?.vectorId ?? ""}
            aria-label="Vector for transformation analysis"
            onChange={(event) => {
              const vectorId = event.target.value;
              setLinearTransformAnalysis(object.id, { vectorId: vectorId === "" ? null : vectorId });
            }}
            className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)]"
          >
            <option value="">Select a vector…</option>
            {vectorOptions.map((candidate) => {
              const meta = getObjectRowDisplayMeta(candidate);
              const candidateIndex = objects.findIndex((o) => o.id === candidate.id);
              return (
                <option key={candidate.id} value={candidate.id}>
                  {meta.label} #{candidateIndex + 1} ({candidate.kind})
                </option>
              );
            })}
          </select>
        </label>
        {appliedVector && !("error" in appliedVector) && (
          <div className="flex flex-col gap-1" role="status" aria-label="Transformed vector">
            <FactRow label="v" value={formatTuple([appliedVector.components.x, appliedVector.components.y, appliedVector.components.z])} />
            <FactRow label="Av" value={formatTuple([appliedVector.product.x, appliedVector.product.y, appliedVector.product.z])} testId="linear-fact-av" />
            <div className="mt-1 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5">
              <span className="text-[12px] text-[var(--text-secondary)]">Show transformed vector</span>
              <Switch
                checked={analysis?.showVector ?? false}
                onCheckedChange={(checked) => setLinearTransformAnalysis(object.id, { showVector: checked })}
                ariaLabel={(analysis?.showVector ?? false) ? "Hide transformed vector" : "Show transformed vector"}
              />
            </div>
          </div>
        )}
        {appliedVector && "error" in appliedVector && (
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
            {appliedVector.error}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1" role="status" aria-label="Eigen analysis">
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Eigendirections
        </h4>
        {!eigen || eigen.unavailable ? (
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">Eigen analysis unavailable.</p>
        ) : eigen.realDirectionCount === 0 ? (
          <>
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" data-testid="linear-fact-eigen-none">
              No real eigendirections.
            </p>
            {eigen.entries
              .filter((entry) => entry.kind === "complex")
              .slice(0, 2)
              .map((entry, index) => (
                <FactRow
                  key={index}
                  label={`Complex λ${index + 1}`}
                  value={entry.kind === "complex" ? formatComplexValue(entry.value) : ""}
                />
              ))}
          </>
        ) : (
          <>
            {eigen.entries
              .filter((entry) => entry.kind === "real")
              .map((entry, index) =>
                entry.kind === "real" ? (
                  <FactRow
                    key={index}
                    label={`λ${index + 1} = ${formatNumber(entry.value)}`}
                    value={formatTuple(entry.vector)}
                    testId={index === 0 ? "linear-fact-eigen" : undefined}
                  />
                ) : null
              )}
            <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
              {eigen.realDirectionCount} independent real eigendirection{eigen.realDirectionCount === 1 ? "" : "s"}.
            </p>
            <div className="mt-1 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5">
              <span className="text-[12px] text-[var(--text-secondary)]">Show eigendirections</span>
              <Switch
                checked={analysis?.showEigen ?? false}
                onCheckedChange={(checked) => setLinearTransformAnalysis(object.id, { showEigen: checked })}
                ariaLabel={(analysis?.showEigen ?? false) ? "Hide eigendirections" : "Show eigendirections"}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function entryMapOf(object: LinearTransformObject): Record<string, string> {
  if (object.dimension === "2d") {
    return { m11: object.m11, m12: object.m12, m21: object.m21, m22: object.m22 };
  }
  return {
    m11: object.m11, m12: object.m12, m13: object.m13,
    m21: object.m21, m22: object.m22, m23: object.m23,
    m31: object.m31, m32: object.m32, m33: object.m33
  };
}

function formatMatrixText(entries: readonly number[], dimension: 2 | 3): string {
  const rows: string[] = [];
  for (let row = 0; row < dimension; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < dimension; col += 1) {
      cells.push(formatNumber(entries[row * dimension + col] as number));
    }
    rows.push(`[${cells.join(", ")}]`);
  }
  return rows.join(" ");
}
