"use client";

import { MathExpression } from "@/components/math/MathExpression";

import { useMemo, useState } from "react";
import type { VectorFieldObject } from "@vinculum/scene/types";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import type { VectorCalculusState } from "@/types/graphUi";
import {
  compileVectorFieldDifferential,
  compileVectorLaplacian,
  evaluateVectorLaplacian,
  evaluateVectorDifferential,
  isFieldPointInDomain,
  vectorCurl3D,
  vectorCurlScalar2D,
  vectorDivergence,
  type EvaluatedJacobian
} from "@/lib/math/vectorCalculus";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";

// S22 Vector Calculus section (Props tab, vector fields only). Pointwise
// Jacobian/divergence/curl derived live from the canonical field — nothing
// computed is stored. Separate from the S21 surface section: different
// source kinds, different identity (parameter keys, not values), different
// invalidation (recompute on param change, clear on math edits).
export default function VectorCalculusSection({ object }: { object: VectorFieldObject }) {
  const record = useGraphStore((state) => state.ui.vectorCalculusBySourceId[object.id]);
  const setPoint = useGraphStore((state) => state.setVectorCalculusPoint);
  const setOverlays = useGraphStore((state) => state.setVectorCalculusOverlays);
  const clearRecord = useGraphStore((state) => state.clearVectorCalculus);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);

  const dimension = object.dimension;
  const is2D = dimension === "2d";

  const model = useMemo(() => {
    const params = paramScope;
    const paramKeys = Object.keys(params);
    // Field validity gates everything (S20 compiler: reserved locals,
    // empty components, unknown symbols).
    const field = compileVectorFieldExpressions(
      dimension,
      object.pExpr,
      object.qExpr,
      object.rExpr,
      params
    );
    if (field.error) {
      return { status: "invalid-field" as const, error: field.error };
    }
    if (!record) {
      return { status: "empty" as const };
    }
    if (vectorCalculusSourceIdentity(object, paramKeys) !== record.structure) {
      return { status: "stale" as const };
    }
    if (!isFieldPointInDomain(dimension, object.domain, record.point)) {
      return { status: "outside" as const };
    }
    const compiled = compileVectorFieldDifferential(
      dimension,
      object.pExpr,
      object.qExpr,
      object.rExpr,
      params
    );
    const jacobian = evaluateVectorDifferential(compiled, record.point, params);
    const values = is2D ? field.evaluate2D?.(record.point.x, record.point.y) : field.evaluate3D?.(record.point.x, record.point.y, record.point.z);
    const laplacian = evaluateVectorLaplacian(compileVectorLaplacian(dimension, is2D ? [object.pExpr, object.qExpr] : [object.pExpr, object.qExpr, object.rExpr], params), { ...params, ...record.point });
    return { status: "values" as const, jacobian, values, laplacian };
  }, [object, record, paramScope, dimension, is2D]);

  return (
    <section
      data-testid="vector-calculus-section"
      className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0"
    >
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Vector Calculus</h3>
      </header>
      <PointInputs key={object.id} object={object} recordPoint={record?.point} onCommit={setPoint} />
      {model.status === "empty" && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-tertiary)]" role="status">
          Enter a point in the field domain to inspect the Jacobian, divergence, and{" "}
          {is2D ? "scalar curl" : "curl"}.
        </p>
      )}
      {model.status === "invalid-field" && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Field has errors — fix the component expressions to enable calculus.
        </p>
      )}
      {model.status === "stale" && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Source changed — set the point again to refresh.
        </p>
      )}
      {model.status === "outside" && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Point is outside the field domain.
        </p>
      )}
      {model.status === "values" && (
        <ValuesBody
          object={object}
          jacobian={model.jacobian}
          fieldValues={model.values}
          laplacian={model.laplacian}
          record={record!}
          onToggleCurl={(showCurl) => setOverlays(object.id, { showCurl })}
          onClear={() => clearRecord(object.id)}
        />
      )}
    </section>
  );
}

function PointInputs({
  object,
  recordPoint,
  onCommit
}: {
  object: VectorFieldObject;
  recordPoint: { x: number; y: number; z: number } | undefined;
  onCommit: (sourceId: string, point: { x: number; y: number; z: number }, structure: string) => void;
}) {
  const domain = object.domain;
  const hint =
    object.dimension === "2d"
      ? `x in [${domain.xMin}, ${domain.xMax}], y in [${domain.yMin}, ${domain.yMax}]`
      : `x in [${domain.xMin}, ${domain.xMax}], y in [${domain.yMin}, ${domain.yMax}], z in [${
          (domain as { zMin: number }).zMin
        }, ${(domain as { zMax: number }).zMax}]`;
  const axes = object.dimension === "2d" ? (["x", "y"] as const) : (["x", "y", "z"] as const);
  const [drafts, setDrafts] = useState<Record<string, string | undefined>>({});

  const commit = (axis: "x" | "y" | "z", raw: string) => {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) {
      return;
    }
    const next = {
      x: recordPoint?.x ?? 0,
      y: recordPoint?.y ?? 0,
      z: recordPoint?.z ?? 0,
      [axis]: value
    };
    const params = parametersToScope(useEditorStore.getState().parameters);
    onCommit(object.id, next, vectorCalculusSourceIdentity(object, Object.keys(params)) ?? "");
  };

  return (
    <div>
      <div className={axes.length === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
        {axes.map((axis) => (
          <label key={axis} className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              {axis}
            </span>
            <Input
              type="number"
              step="any"
              value={drafts[axis] ?? String(recordPoint?.[axis] ?? "")}
              aria-label={`Analysis point ${axis}`}
              onChange={(event) => {
                const next = event.target.value;
                setDrafts((prev) => ({ ...prev, [axis]: next }));
                if (next.trim() !== "" && Number.isFinite(Number(next))) {
                  commit(axis, next);
                }
              }}
              onBlur={() => setDrafts((prev) => ({ ...prev, [axis]: undefined }))}
              className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px]"
            />
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-tertiary)]">Point must lie in {hint}.</p>
    </div>
  );
}

function ValuesBody({
  object,
  jacobian,
  fieldValues,
  laplacian,
  record,
  onToggleCurl,
  onClear
}: {
  object: VectorFieldObject;
  jacobian: EvaluatedJacobian;
  fieldValues: number[] | undefined;
  laplacian: (number | null)[];
  record: VectorCalculusState;
  onToggleCurl: (showCurl: boolean) => void;
  onClear: () => void;
}) {
  const is2D = object.dimension === "2d";
  const finiteField = fieldValues?.every(Number.isFinite) ? fieldValues : null;
  const magnitude = finiteField ? Math.hypot(...finiteField) : null;
  const direction = magnitude && finiteField ? finiteField.map((value) => value / magnitude) : null;
  const rowLabels = is2D ? ["P", "Q"] : ["P", "Q", "R"];
  const colLabels = is2D ? ["x", "y"] : ["x", "y", "z"];
  const divergence = vectorDivergence(jacobian);
  const curl3D = !is2D ? vectorCurl3D(jacobian) : null;
  const curlScalar = is2D ? vectorCurlScalar2D(jacobian) : null;

  const missingDiagonal = (["Px", "Qy", "Rz"] as const)
    .slice(0, is2D ? 2 : 3)
    .filter((_, i) => jacobian.values[i]?.[i] == null);

  return (
    <div className="mt-2 flex flex-col gap-2.5" role="status" aria-label="Vector calculus results">
      <div className="space-y-1 text-[12px] text-[var(--text-secondary)]">
        <p>Field value = {finiteField ? <MathExpression expression={`<${finiteField.map(formatNumber).join(", ")}>`} /> : "unavailable"}</p>
        <p>Magnitude = {magnitude === null ? "unavailable" : <MathExpression expression={formatNumber(magnitude)} />}</p>
        <p data-testid="field-point-direction">Unit direction = {direction ? <MathExpression expression={`<${direction.map(formatNumber).join(", ")}>`} /> : magnitude === 0 ? "undefined (zero field)" : "unavailable"}</p>
        {is2D && direction ? <p>Angle = <MathExpression expression={formatNumber(Math.atan2(direction[1]!, direction[0]!))} /> rad</p> : null}
        <p data-testid="field-point-laplacian">Vector Laplacian = <MathExpression expression={`<${laplacian.map((value) => value === null ? "unavailable" : formatNumber(value)).join(", ")}>`} /></p>
      </div>
      <table data-testid="vector-calculus-jacobian" className="w-full border-collapse text-[12px]">
        <caption className="pb-1 text-left text-[11px] font-medium text-[var(--text-tertiary)]">
          Jacobian
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-8" aria-label="Component">
              <span aria-hidden="true"> </span>
            </th>
            {colLabels.map((label) => (
              <th key={label} scope="col" className="px-1 py-0.5 text-center font-semibold text-[var(--text-tertiary)]">
                <MathExpression expression={`∂/∂${label}`} latex={`\\frac{\\partial}{\\partial ${label}}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row, i) => (
            <tr key={row}>
              <th scope="row" className="px-1 py-0.5 text-left font-semibold text-[var(--text-tertiary)]">
                <MathExpression expression={row} />
              </th>
              {colLabels.map((_, j) => {
                const value = jacobian.values[i]?.[j];
                return (
                  <td key={j} className="px-1 py-0.5 text-right text-[var(--text-secondary)]">
                    {typeof value === "number" ? <MathExpression expression={formatNumber(value)} /> : <span className="italic">unavailable</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="vector-calculus-divergence" className="text-[12px] text-[var(--text-secondary)]">
        Divergence = {divergence === null ? <span className="italic">unavailable</span> : <MathExpression expression={formatNumber(divergence)} />}
        {divergence === null && missingDiagonal.length > 0 && (
          <span className="ml-1 font-sans text-[11px] text-[var(--text-tertiary)]">
            (needs {missingDiagonal.join(", ")})
          </span>
        )}
      </p>
      {is2D ? (
        <p data-testid="vector-calculus-curl" className="text-[12px] text-[var(--text-secondary)]">
          Scalar curl = {curlScalar === null ? <span className="italic">unavailable</span> : <MathExpression expression={formatNumber(curlScalar)} />}
        </p>
      ) : (
        <p data-testid="vector-calculus-curl" className="text-[12px] text-[var(--text-secondary)]">
          Curl ={" "}
          {curl3D === null || curl3D.x === null || curl3D.y === null || curl3D.z === null ? (
            <span className="italic">unavailable</span>
          ) : (
            <MathExpression expression={`<${formatNumber(curl3D.x)}, ${formatNumber(curl3D.y)}, ${formatNumber(curl3D.z)}>`} />
          )}
        </p>
      )}
      {!is2D && (
        <div className="flex items-center justify-between py-1">
          <span className="text-[12px] text-[var(--text-secondary)]">Show curl vector</span>
          <Switch
            checked={record.showCurl}
            onCheckedChange={onToggleCurl}
            ariaLabel={record.showCurl ? "Hide curl vector" : "Show curl vector"}
          />
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear vector calculus analysis"
          className="h-8 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
