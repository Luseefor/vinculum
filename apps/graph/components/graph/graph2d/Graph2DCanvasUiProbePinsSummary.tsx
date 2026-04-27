"use client";

import type { Axis2DPair, GraphProbePin } from "@/types/graphUi";
import { formatProbeCoord } from "./graph2dCanvasFormat";
import { projectWorldTo2dPair } from "./graph2dCanvasProbes";
import type { AxisPairSpec } from "./graph2dCanvasTypes";

export type Graph2DCanvasUiProbePinsSummaryProps = {
  axisPair: AxisPairSpec;
  probePins: GraphProbePin[];
  pairForCanvas: Axis2DPair;
};

export function Graph2DCanvasUiProbePinsSummary({
  axisPair,
  probePins,
  pairForCanvas
}: Graph2DCanvasUiProbePinsSummaryProps) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-lg">
      <div className="mb-0.5 text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">
        Pinned ({probePins.length})
      </div>
      {probePins.slice(-3).reverse().map((p) => {
        const math = projectWorldTo2dPair(p.world, pairForCanvas);
        return (
          <div key={p.id} className="mt-0.5 first:mt-0 whitespace-nowrap">
            <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: p.color }} />
            {axisPair.horizontalLabel}: {formatProbeCoord(math.horizontal)} · {axisPair.verticalLabel}:{" "}
            {formatProbeCoord(math.vertical)}
          </div>
        );
      })}
      {probePins.length > 3 && <div className="mt-0.5 text-[var(--text-tertiary)] opacity-60">...</div>}
    </div>
  );
}
