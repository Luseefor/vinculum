"use client";

import { MathExpression } from "@/components/math/MathExpression";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ParametricCurveObject,
  ParametricSurfaceObject,
  SurfaceGraphObject,
  VectorFieldObject
} from "@vinculum/scene/types";
import { MathInput } from "@/components/math/MathInput";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { buildIntegralJob, getIntegralSyncContext, syncIntegralAnalysis } from "@/lib/compute/integralSync";
import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import FieldSolutionView from "./FieldSolutionView";
import { buildIntegralSolution } from "@/lib/math/integralSolution";
import { StatusCallout } from "@/components/ui/StatusCallout";
import type { IntegralAnalysisConfig, IntegralAnalysisMode } from "@/types/graphUi";

type IntegralTarget =
  | ParametricCurveObject
  | SurfaceGraphObject
  | ParametricSurfaceObject;

// S25 Integral Analysis (Props tab): one active mode per target (PART
// 19). Arc length and surface area compute automatically once selected;
// scalar/work/flux modes need a committed integrand or a referenced
// canonical field (IDs only — expressions are never copied). Integrand
// text stays a local draft until Enter/blur commits it, so typing never
// dispatches worker jobs (PART 29 option B, S22 draft convention).
// Results display only when the stored signature matches the live
// composite signature — stale numbers can never present as current.
const CURVE_MODES: Array<{ value: IntegralAnalysisMode; label: string }> = [
  { value: "arcLength", label: "Arc length" },
  { value: "scalarLine", label: "Scalar line integral" },
  { value: "work", label: "Work / circulation" }
];

const SURFACE_MODES: Array<{ value: IntegralAnalysisMode; label: string }> = [
  { value: "surfaceArea", label: "Surface area" },
  { value: "scalarSurface", label: "Scalar surface integral" },
  { value: "flux", label: "Flux" }
];

export default function IntegralAnalysisSection({ object }: { object: IntegralTarget }) {
  const objects = useGraphStore((state) => state.scene.objects);
  const config = useGraphStore((state) => state.ui.integralAnalysisBySourceId[object.id]);
  const setConfig = useGraphStore((state) => state.setIntegralConfig);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);
  const computeStatus = useGeometryComputeStore(
    (state) => state.entries[`integral:${object.id}`]?.status ?? "idle"
  );
  const computeMessage = useGeometryComputeStore(
    (state) => state.entries[`integral:${object.id}`]?.message ?? null
  );
  const resultEntry = useIntegralResultsStore((state) => state.entries[`integral:${object.id}`]);

  const isCurve = object.kind === "parametricCurve";
  const modes = isCurve ? CURVE_MODES : SURFACE_MODES;
  const defaultMode = isCurve ? "arcLength" : "surfaceArea";
  const mode = config?.mode ?? (defaultMode as IntegralAnalysisMode);

  // Pump desired jobs whenever sources, configs, or params change. The
  // signature ledger makes tab/theme/camera changes enqueue 0 jobs; the
  // applier backstop discards anything that went stale mid-flight.
  useEffect(() => {
    syncIntegralAnalysis(getIntegralSyncContext(), objects, paramScope);
  }, [objects, paramScope, config]);

  // Auto-create the input-free default config on first mount so arc
  // length / surface area compute without ceremony; scalar/work/flux
  // wait for their integrand/field inputs (needs-input states below).
  useEffect(() => {
    if (!config) {
      setConfig(object.id, { mode: defaultMode as IntegralAnalysisMode });
    }
    // Mount-only: later edits flow through the controls below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desired = useMemo(
    () => buildIntegralJob(objects, config, paramScope),
    [objects, config, paramScope]
  );
  const liveResult = resultEntry && desired && resultEntry.signature === desired.signature ? resultEntry.result : null;

  const needsIntegrand = mode === "scalarLine" || mode === "scalarSurface";
  const needsField = mode === "work" || mode === "flux";
  const fieldObject = needsField
    ? (objects.find((candidate) => candidate.id === config?.vectorFieldId) ?? null)
    : null;
  const fieldIncompatible =
    needsField &&
    config?.vectorFieldId !== null &&
    config?.vectorFieldId !== undefined &&
    (!fieldObject || (fieldObject as VectorFieldObject).kind !== "vectorField" || (fieldObject as VectorFieldObject).dimension !== "3d");

  const orientationAxis = object.kind === "surface" ? (object.orientation ?? "z") : null;
  const orientationLabels = useMemo(() => {
    if (orientationAxis === null) {
      return { native: "u×v (native)", reversed: "Reversed" } as const;
    }
    // S32: explicit-surface orientation in mathematical +axis/−axis form
    // (values stay native/reversed for the engine).
    return { native: `+${orientationAxis} (native)`, reversed: `−${orientationAxis} (reversed)` } as const;
  }, [orientationAxis]);

  return (
    <section
      data-testid="integral-analysis-section"
      className="border-b border-[var(--border-subtle)] pb-4 last:border-b-0 last:pb-0"
    >
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Integral Analysis</h3>
      </header>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              Mode
            </span>
            <select
              value={mode}
              aria-label="Integral mode"
              onChange={(event) => {
                const next = event.target.value;
                if (next === "arcLength" || next === "scalarLine" || next === "work" || next === "surfaceArea" || next === "scalarSurface" || next === "flux") {
                  setConfig(object.id, { mode: next });
                }
              }}
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
            >
              {modes.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              Quality
            </span>
            <select
              value={config?.quality ?? "medium"}
              aria-label="Integral quality"
              onChange={(event) => {
                const quality = event.target.value;
                if (quality === "low" || quality === "medium" || quality === "high") {
                  setConfig(object.id, { quality });
                }
              }}
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        {needsIntegrand && (
          <IntegrandInput
            key={object.id}
            committed={config?.scalarIntegrand ?? ""}
            onCommit={(scalarIntegrand) => setConfig(object.id, { scalarIntegrand })}
          />
        )}
        {needsField && (
          <FieldSelector
            fields={objects.filter(
              (candidate): candidate is VectorFieldObject =>
                candidate.kind === "vectorField" && candidate.dimension === "3d"
            )}
            numberFor={(fieldId) => objects.findIndex((candidate) => candidate.id === fieldId)}
            selectedId={config?.vectorFieldId ?? null}
            onSelect={(vectorFieldId) => setConfig(object.id, { vectorFieldId })}
          />
        )}
        {mode === "work" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              Direction
            </span>
            <select
              value={config?.direction === -1 ? "reverse" : "forward"}
              aria-label="Curve direction"
              onChange={(event) => {
                setConfig(object.id, { direction: event.target.value === "reverse" ? -1 : 1 });
              }}
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
            >
              <option value="forward">Forward</option>
              <option value="reverse">Reverse</option>
            </select>
          </label>
        )}
        {mode === "flux" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
              Orientation
            </span>
            <select
              value={config?.orientationSign === -1 ? "reversed" : "native"}
              aria-label="Surface orientation"
              onChange={(event) => {
                setConfig(object.id, { orientationSign: event.target.value === "reversed" ? -1 : 1 });
              }}
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
            >
              <option value="native">{orientationLabels.native}</option>
              <option value="reversed">{orientationLabels.reversed}</option>
            </select>
          </label>
        )}
        <ResultBody
          mode={mode}
          desired={desired !== null}
          needsIntegrand={needsIntegrand}
          needsField={needsField}
          hasIntegrand={(config?.scalarIntegrand ?? "").trim() !== ""}
          hasField={!!config?.vectorFieldId && !!fieldObject && !fieldIncompatible}
          fieldIncompatible={!!fieldIncompatible}
          computeStatus={computeStatus}
          computeMessage={computeMessage}
          liveResult={liveResult}
        />
        {liveResult?.status === "ok" && desired ? <FieldSolutionView solution={buildIntegralSolution(desired.payload, liveResult)} /> : null}
      </div>
    </section>
  );
}

function IntegrandInput({ committed, onCommit }: { committed: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const draftRef = useRef<string | undefined>(undefined);
  const onCommitRef = useRef(onCommit);
  // Ref assignment in an effect (never during render) so a concurrent
  // aborted render cannot leave a stale draft for the unmount cleanup.
  useEffect(() => {
    draftRef.current = draft;
    onCommitRef.current = onCommit;
  });
  // S32: commit the pending draft on unmount (Object↔Analyze switch,
  // selection change) so a valid typed integrand is never silently
  // destroyed. Follows the established blur/Enter commit model.
  useEffect(
    () => () => {
      const pending = draftRef.current;
      if (pending !== undefined && pending !== committed) {
        onCommitRef.current(pending);
      }
    },
    // Mount-only cleanup contract: refs carry the latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
        Scalar integrand g(x,y,z)
      </span>
      <MathInput
        type="text"
        value={draft ?? committed}
        aria-label="Scalar integrand g(x,y,z)"
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== undefined) {
            onCommit(draft);
            setDraft(undefined);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft !== undefined) {
            onCommit(draft);
            setDraft(undefined);
          } else if (event.key === "Escape") {
            setDraft(undefined);
          }
        }}
        className="h-8 rounded-[var(--radius-sm)] border-[var(--border-subtle)] bg-transparent px-2.5 font-mono text-[13px]"
      />
    </label>
  );
}

function FieldSelector({
  fields,
  numberFor,
  selectedId,
  onSelect
}: {
  fields: VectorFieldObject[];
  numberFor: (fieldId: string) => number;
  selectedId: string | null;
  onSelect: (fieldId: string | null) => void;
}) {
  const selectedField = fields.find((field) => field.id === selectedId);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
        Vector field
      </span>
      <select
        value={selectedId ?? ""}
        aria-label="Vector field"
        onChange={(event) => {
          onSelect(event.target.value === "" ? null : event.target.value);
        }}
        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-primary)]"
      >
        <option value="">Select a field…</option>
        {fields.map((field) => {
          // S32: global scene numbering matches the navigator row order.
          const number = numberFor(field.id);
          return (
            <option key={field.id} value={field.id}>
              3D Vector Field #{number + 1}
            </option>
          );
        })}
      </select>
      {selectedField ? <span className="mt-1 block min-w-0 text-[12px] text-[var(--text-secondary)]"><MathExpression expression={`<${selectedField.pExpr}, ${selectedField.qExpr}, ${selectedField.rExpr}>`} /></span> : null}
    </label>
  );
}

function ResultBody({
  mode,
  desired,
  needsIntegrand,
  needsField,
  hasIntegrand,
  hasField,
  fieldIncompatible,
  computeStatus,
  computeMessage,
  liveResult
}: {
  mode: IntegralAnalysisConfig["mode"];
  desired: boolean;
  needsIntegrand: boolean;
  needsField: boolean;
  hasIntegrand: boolean;
  hasField: boolean;
  fieldIncompatible: boolean;
  computeStatus: "idle" | "pending" | "error";
  computeMessage: string | null;
  liveResult: { status: string; value?: number; estimatedError?: number; convergenceWarning?: boolean; reason?: string | null } | null;
}) {
  if (needsField && fieldIncompatible) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
        Select a compatible 3D vector field.
      </p>
    );
  }
  if (needsField && !hasField) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]" role="status">
        Select a vector field to compute {mode === "work" ? "work" : "flux"}.
      </p>
    );
  }
  if (needsIntegrand && !hasIntegrand) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]" role="status">
        Enter a scalar integrand to compute.
      </p>
    );
  }
  if (!desired) {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]" role="status">
        Not computed yet.
      </p>
    );
  }
  if (liveResult) {
    if (liveResult.status === "ok") {
      return (
        <div className="flex flex-col gap-1" role="status" aria-label="Integral result">
          <p data-testid="integral-result-value" className="font-mono text-[13px] text-[var(--text-primary)]">
            Value: <MathExpression expression={formatNumber(liveResult.value ?? Number.NaN)} />
          </p>
          <p data-testid="integral-result-error" className="font-mono text-[12px] text-[var(--text-secondary)]">
            Estimated numerical error:{" "}
            {Number.isFinite(liveResult.estimatedError) ? <MathExpression expression={`~${formatNumber(liveResult.estimatedError as number)}`} /> : "unavailable"}
          </p>
          {liveResult.convergenceWarning === true && (
            <StatusCallout tone="warning" className="mt-1">
              Result has not converged closely at this quality.
            </StatusCallout>
          )}
        </div>
      );
    }
    if (liveResult.status === "unsupported") {
      return (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Derivative unavailable for this source.
        </p>
      );
    }
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
        {liveResult.reason ?? "Integrand is non-finite in the integration domain."}
      </p>
    );
  }
  if (computeStatus === "pending") {
    return (
      <p className="text-[11px] text-[var(--text-tertiary)]" role="status">
        Computing integral…
      </p>
    );
  }
  if (computeStatus === "error") {
    return (
      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
        {computeMessage ?? "Integral computation failed; edit to retry."}
      </p>
    );
  }
  return (
    <p className="text-[11px] text-[var(--text-tertiary)]" role="status">
      Computing integral…
    </p>
  );
}
