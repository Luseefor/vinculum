// S26 Inspector section for geometric primitives (PART 27):
// contextual definition via the shared coordinate editor — no duplicate
// giant editor. Read-only magnitude/length rides the status line inside
// the editor (PART 27: trivial, already resolved); full measurement
// belongs to S27.

"use client";

import { useMemo } from "react";
import type { LineObject, PointObject, RayObject, SegmentObject, VectorObject } from "@vinculum/scene/types";
import GeometryCoordinateFields from "@/components/objects/GeometryCoordinateFields";

type PrimitiveObject = PointObject | VectorObject | LineObject | RayObject | SegmentObject;

const KIND_TITLES = {
  point: "Point",
  vector: "Vector",
  line: "Infinite Line",
  ray: "Ray",
  segment: "Segment"
} as const;

const KIND_DESCRIPTIONS = {
  point: "Exactly one mathematical location P=(x,y,z).",
  vector: "One geometric vector: components plus a visual anchor origin.",
  line: "P + t·d for all t. Display is a renderer-owned finite clip.",
  ray: "O + t·d for t ≥ 0, with a direction marker.",
  segment: "Straight connection from start to end."
} as const;

export default function GeometryPrimitiveInspector({ object, index }: { object: PrimitiveObject; index: number }) {
  const selectedTitle = index >= 0 ? ` #${index + 1}` : "";
  const title = useMemo(() => KIND_TITLES[object.kind], [object.kind]);

  return (
    <div className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2">
      <div className="mb-2 flex items-center justify-between rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: object.color }} />
          <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
            {title}
            {selectedTitle}
          </h3>
        </div>
        <span className="rounded-[6px] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {object.kind}
        </span>
      </div>

      <p className="mb-2 px-0.5 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
        {KIND_DESCRIPTIONS[object.kind]}
      </p>

      <GeometryCoordinateFields object={object} />
    </div>
  );
}
