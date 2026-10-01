"use client";

import { useEditorStore } from "@/lib/store/editorStore";
import type { BottomPanelTab } from "@/lib/types/ui";
import { CloseIcon } from "@/components/layout/icons";
import { useGraphStore } from "@/store/graphStore";
import { usePerformanceMetricsSnapshot } from "@/lib/performance/usePerformanceMetrics";
import AnimationTab from "@/components/inspector/AnimationTab";

export const DOCK_TABS: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "parameters", label: "Parameters" },
  { id: "console", label: "Console" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "measurements", label: "Measurements" },
  { id: "performance", label: "Performance" }
];

export default function BottomPanel({ height: controlledHeight }: { height?: number }) {
  const collapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const setCollapsed = useEditorStore((state) => state.setBottomPanelCollapsed);
  const storeHeight = useEditorStore((state) => state.bottomPanelHeight);
  const height = controlledHeight ?? storeHeight;
  const activeTab = useEditorStore((state) => state.bottomPanelTab);
  const parameters = useEditorStore((state) => state.parameters);
  const setParameterValue = useEditorStore((state) => state.setParameterValue);
  const consoleEvents = useEditorStore((state) => state.consoleEvents);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => state.scene.objects.filter((object) => object.visible).length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const measurements = useGraphStore((state) => state.scene.measurements);
  const perf = usePerformanceMetricsSnapshot();

  if (collapsed) {
    return null;
  }

  const activeLabel = DOCK_TABS.find((tab) => tab.id === activeTab)?.label ?? "Panel";

  return (
    <section
      aria-label={`${activeLabel} panel`}
      className="bottom-dock flex flex-col border-t border-[var(--border-subtle)] bg-[var(--editor-chrome)]"
      style={{ height }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">{activeLabel}</p>
        <button
          type="button"
          aria-label="Close panel"
          title="Close panel"
          onClick={() => setCollapsed(true)}
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {(
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-3">
          {activeTab === "parameters" && (
            <>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              {parameters.map((param) => (
                <div key={param.id} className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2">
                  <span className="w-4 text-[11px] font-semibold text-[var(--text-secondary)]">{param.id}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={0.01}
                    value={param.value}
                    aria-label={`Parameter ${param.id}`}
                    onChange={(e) => setParameterValue(param.id, Number(e.target.value))}
                    className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--surface-muted)] accent-[var(--accent)]"
                  />
                  <span className="w-12 text-right font-mono text-[11px] font-semibold text-[var(--text-primary)]">
                    {param.value.toFixed(2)}
                  </span>
                </div>
              ))}
              {parameters.length === 0 && (
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] italic">No parameters defined.</p>
              )}
            </div>
            {/* S30: global parameter animation lives with the parameters it
                drives, not in the per-object Inspector. */}
            <div className="mt-3 max-w-2xl">
              <AnimationTab />
            </div>
            </>
          )}

          {activeTab === "console" && (
            <div className="pr-1 font-mono text-[11px]">
              {consoleEvents.map((ev, i) => (
                <div key={i} className="flex gap-2 border-b border-[var(--border-subtle)] py-1">
                  <span className="text-[var(--text-tertiary)]">[{i}]</span>
                  <span className="text-[var(--text-secondary)]">{ev}</span>
                </div>
              ))}
              {consoleEvents.length === 0 && <p className="text-[var(--text-tertiary)] italic">Console is empty.</p>}
            </div>
          )}

          {activeTab === "diagnostics" && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <DiagnosticStat label="Viewport Mode" value={graphMode.toUpperCase()} />
              <DiagnosticStat label="Objects in Scene" value={String(objectCount)} />
              <DiagnosticStat label="Visible Objects" value={String(visibleCount)} />
              <DiagnosticStat label="Selected ID" value={selectedObjectId?.slice(0, 8) ?? "NONE"} />
            </div>
          )}
          {activeTab === "measurements" && (
            <div className="space-y-2">
              {measurements.length === 0 ? (
                <p className="text-[12px] text-[var(--text-tertiary)]">No measurements recorded.</p>
              ) : (
                measurements.map((measurement) => (
                  <div key={measurement.id} className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-transparent px-2.5 py-2 text-[12px]">
                    <span className="mr-2 font-semibold text-[var(--text-tertiary)]">{measurement.kind}</span>
                    <span className="font-mono text-[var(--text-secondary)]">{measurement.id.slice(0, 12)}</span>
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === "performance" && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <DiagnosticStat
                label="Paint Time"
                value={perf.lastFrameTimeMs !== null ? `${perf.lastFrameTimeMs.toFixed(1)} ms` : "--"}
              />
              <DiagnosticStat
                label="Objects"
                value={`${perf.scenePressure.visibleObjectCount}/${perf.scenePressure.objectCount}`}
              />
              <DiagnosticStat
                label="Warning"
                value={perf.warningLevel.toUpperCase()}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DiagnosticStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2.5">
      <p className="text-[11px] font-medium text-[var(--text-tertiary)]">{label}</p>
      <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
