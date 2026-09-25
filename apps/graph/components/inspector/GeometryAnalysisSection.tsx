// S27 Geometry Analysis Inspector section (PART 22): contextual facts
// for the selected source paired with a compatible second object. All
// cheap relevant facts render together (no operation picker ceremony);
// numbers compute synchronously from live sources every render — nothing
// is cached, so parameters, undo/redo, and workspace switches never show
// stale math. One explicit construction toggle per pair (PART 23).

"use client";

import { useMemo } from "react";
import type { GraphObject } from "@vinculum/scene/types";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { parametersToScope } from "@/lib/store/editorParameters";
import { formatNumber } from "@/components/graph/graph2d/graph2dCanvasFormat";
import { Switch } from "@/components/ui/switch";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import {
  computeGeometryFacts,
  geometryPairSupported,
  radiansToDegrees,
  resolveGeometrySource,
  type GeometryAnalysisFacts
} from "@/lib/math/geometryAnalysis";

function formatPoint(point: { x: number; y: number; z: number }): string {
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)}, ${formatNumber(point.z)})`;
}

function formatDegrees(radians: number | null): string {
  if (radians === null || !Number.isFinite(radians)) {
    return "—";
  }
  return `${formatNumber(radiansToDegrees(radians))}°`;
}

function formatDistance(distance: number | null): string {
  if (distance === null || !Number.isFinite(distance)) {
    return "—";
  }
  return formatNumber(distance);
}

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

function FactsBlock({ facts }: { facts: GeometryAnalysisFacts }) {
  switch (facts.pair) {
    case "point-point":
      return <FactRow label="Distance" value={formatDistance(facts.distance)} testId="geometry-fact-distance" />;
    case "point-linear":
      return (
        <>
          <FactRow label="Closest point" value={formatPoint(facts.projection.point)} testId="geometry-fact-point" />
          <FactRow label="Distance" value={formatDistance(facts.projection.distance)} testId="geometry-fact-distance" />
        </>
      );
    case "point-plane":
      return (
        <>
          <FactRow label="Projection" value={formatPoint(facts.projection.projection)} testId="geometry-fact-point" />
          <FactRow label="Distance" value={formatDistance(facts.projection.distance)} testId="geometry-fact-distance" />
          <FactRow label="Signed distance" value={formatNumber(facts.projection.signedDistance)} />
        </>
      );
    case "vector-vector":
      return (
        <>
          <FactRow label="Angle" value={formatDegrees(facts.angleRadians)} testId="geometry-fact-angle" />
          <FactRow
            label="Relation"
            value={
              facts.angleRadians === null
                ? "Angle undefined (zero vector)."
                : facts.parallel
                  ? "Parallel directions."
                  : facts.perpendicular
                    ? "Perpendicular directions."
                    : "Neither parallel nor perpendicular."
            }
            testId="geometry-fact-relation"
          />
        </>
      );
    case "linear-linear":
      return <LinearLinearFacts facts={facts} />;
    case "linear-plane":
      return <LinearPlaneFacts facts={facts} />;
    case "plane-plane":
      return <PlanePlaneFacts facts={facts} />;
    case "unresolved":
      return (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          {facts.reason}
        </p>
      );
    case "incompatible":
      return (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]" role="status">
          Select a compatible second object.
        </p>
      );
  }
}

function LinearLinearFacts({
  facts
}: {
  facts: Extract<GeometryAnalysisFacts, { pair: "linear-linear" }>;
}) {
  const relation = facts.relation;
  return (
    <>
      <FactRow
        label="Relationship"
        value={
          relation.kind === "intersect"
            ? "Intersecting."
            : relation.kind === "overlap"
              ? relation.bounded === "segment"
                ? "Overlapping (segment)."
                : "Overlapping (ray)."
              : relation.kind === "coincident"
                ? "Coincident."
                : relation.kind === "parallel-disjoint"
                  ? "Parallel, disjoint."
                  : relation.kind === "skew"
                    ? "Skew."
                    : "Disjoint."
        }
        testId="geometry-fact-relation"
      />
      {"distance" in relation && relation.kind !== "intersect" ? (
        <FactRow label="Distance" value={formatDistance(relation.distance)} testId="geometry-fact-distance" />
      ) : relation.kind === "intersect" ? (
        <>
          <FactRow label="Intersection" value={formatPoint(relation.point)} testId="geometry-fact-point" />
          <FactRow label="Distance" value="0" />
        </>
      ) : null}
      {relation.kind === "overlap" && relation.start && relation.end ? (
        <>
          <FactRow label="Overlap start" value={formatPoint(relation.start)} />
          <FactRow label="Overlap end" value={formatPoint(relation.end)} />
        </>
      ) : null}
      {(relation.kind === "disjoint" || relation.kind === "skew" || relation.kind === "parallel-disjoint") && (
        <>
          <FactRow label="Closest A" value={formatPoint(relation.pointA)} />
          <FactRow label="Closest B" value={formatPoint(relation.pointB)} />
        </>
      )}
      <FactRow label="Angle" value={formatDegrees(facts.angleRadians)} testId="geometry-fact-angle" />
      {relation.kind === "skew" && (
        <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          Directions nonparallel with positive distance; closest points shown above.
        </p>
      )}
    </>
  );
}

function LinearPlaneFacts({ facts }: { facts: Extract<GeometryAnalysisFacts, { pair: "linear-plane" }> }) {
  const intersection = facts.intersection;
  return (
    <>
      <FactRow
        label="Relationship"
        value={
          intersection.kind === "point"
            ? "Intersecting."
            : intersection.kind === "contained"
              ? "Contained in plane."
              : intersection.kind === "parallel"
                ? "Parallel, disjoint."
                : "Outside ray/segment domain."
        }
        testId="geometry-fact-relation"
      />
      {intersection.kind === "point" && (
        <FactRow label="Intersection" value={formatPoint(intersection.point)} testId="geometry-fact-point" />
      )}
      <FactRow label="Distance" value={formatDistance(facts.distance)} testId="geometry-fact-distance" />
      <FactRow label="Angle" value={formatDegrees(facts.angleRadians)} testId="geometry-fact-angle" />
    </>
  );
}

function PlanePlaneFacts({ facts }: { facts: Extract<GeometryAnalysisFacts, { pair: "plane-plane" }> }) {
  const intersection = facts.intersection;
  return (
    <>
      <FactRow
        label="Relationship"
        value={
          intersection.kind === "line"
            ? "Intersecting."
            : intersection.kind === "coincident"
              ? "Coincident."
              : "Parallel, disjoint."
        }
        testId="geometry-fact-relation"
      />
      <FactRow label="Distance" value={formatDistance(facts.distance)} testId="geometry-fact-distance" />
      <FactRow label="Angle" value={formatDegrees(facts.angleRadians)} testId="geometry-fact-angle" />
    </>
  );
}

/** Whether this pair kind offers a construction overlay toggle. */
export function geometryPairHasOverlay(facts: GeometryAnalysisFacts): boolean {
  switch (facts.pair) {
    case "point-linear":
    case "point-plane":
      return true;
    case "linear-linear":
      return (
        facts.relation.kind === "intersect" ||
        facts.relation.kind === "overlap" ||
        facts.relation.kind === "parallel-disjoint" ||
        facts.relation.kind === "skew" ||
        facts.relation.kind === "disjoint"
      );
    case "linear-plane":
      return facts.intersection.kind === "point";
    case "plane-plane":
      return facts.intersection.kind === "line";
    default:
      return false;
  }
}

export default function GeometryAnalysisSection({ object }: { object: GraphObject }) {
  const objects = useGraphStore((state) => state.scene.objects);
  const config = useGraphStore((state) => state.ui.geometryAnalysisBySourceId[object.id]);
  const setGeometryAnalysis = useGraphStore((state) => state.setGeometryAnalysis);
  const clearGeometryAnalysis = useGraphStore((state) => state.clearGeometryAnalysis);
  const editorParameters = useEditorStore((state) => state.parameters);
  const paramScope = useMemo(() => parametersToScope(editorParameters), [editorParameters]);

  const options = useMemo(
    () =>
      objects.filter(
        (candidate) => candidate.id !== object.id && geometryPairSupported(object.kind, candidate.kind)
      ),
    [objects, object.id, object.kind]
  );

  // A stored secondary may have been deleted or converted since: fall
  // back to "select another object" instead of resolving a ghost.
  const secondary = config ? objects.find((candidate) => candidate.id === config.secondaryId) ?? null : null;

  const facts = useMemo<GeometryAnalysisFacts | null>(() => {
    if (!config || !secondary) {
      return null;
    }
    if (!geometryPairSupported(object.kind, secondary.kind)) {
      return { pair: "incompatible" };
    }
    return computeGeometryFacts(
      resolveGeometrySource(object, paramScope),
      resolveGeometrySource(secondary, paramScope)
    );
  }, [config, secondary, object, paramScope]);

  return (
    <section
      data-testid="geometry-analysis-section"
      className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-3"
    >
      <header className="pb-2">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Geometry Analysis</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
          Distances, projections, angles, and intersections with a second object.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Second object
          </span>
          <select
            value={secondary?.id ?? ""}
            aria-label="Second object for geometry analysis"
            onChange={(event) => {
              const secondaryId = event.target.value;
              if (secondaryId) {
                setGeometryAnalysis(object.id, { secondaryId });
              } else {
                clearGeometryAnalysis(object.id);
              }
            }}
            className="h-8 w-full rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)]"
          >
            <option value="">Select another object…</option>
            {options.map((candidate) => {
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
        {!config || !secondary ? (
          <p className="text-[12px] leading-relaxed text-[var(--text-tertiary)]" role="status">
            Select another object.
          </p>
        ) : (
          facts && (
            <div className="flex flex-col gap-1">
              <FactsBlock facts={facts} />
              {geometryPairHasOverlay(facts) && (
                <div className="mt-1 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5">
                  <span className="text-[12px] text-[var(--text-secondary)]">Show construction</span>
                  <Switch
                    checked={config.showOverlay}
                    onCheckedChange={(checked) => setGeometryAnalysis(object.id, { showOverlay: checked })}
                    ariaLabel={config.showOverlay ? "Hide construction overlay" : "Show construction overlay"}
                  />
                </div>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}
