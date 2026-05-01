"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import type { BottomPanelTab } from "@/lib/types/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import { usePerformanceMetricsSnapshot } from "@/lib/performance/usePerformanceMetrics";

type DockTab = BottomPanelTab | "measurements" | "performance";

const tabs: Array<{ id: DockTab; label: string }> = [
  { id: "parameters", label: "PARAMETERS" },
  { id: "console", label: "CONSOLE" },
  { id: "diagnostics", label: "DIAGNOSTICS" },
  { id: "measurements", label: "MEASUREMENTS" },
  { id: "performance", label: "PERFORMANCE" }
];

export default function BottomPanel({ height: controlledHeight }: { height?: number }) {
  const collapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const storeHeight = useEditorStore((state) => state.bottomPanelHeight);
  const height = controlledHeight ?? storeHeight;
  const activeTab = useEditorStore((state) => state.bottomPanelTab);
  const setTab = useEditorStore((state) => state.setBottomPanelTab);
  const parameters = useEditorStore((state) => state.parameters);
  const setParameterValue = useEditorStore((state) => state.setParameterValue);
  const consoleEvents = useEditorStore((state) => state.consoleEvents);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => state.scene.objects.filter((object) => object.visible).length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const measurements = useGraphStore((state) => state.scene.measurements);
  const perf = usePerformanceMetricsSnapshot();
  const [extraTab, setExtraTab] = useState<"measurements" | "performance" | null>(null);

  return (
    <section
      className={cn(
        "flex flex-col border-t border-[var(--border-strong)] bg-[var(--editor-chrome)] transition-all duration-300",
        collapsed ? "h-9" : ""
      )}
      style={!collapsed ? { height } : {}}
    >
      <div className="flex h-9 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        <div className="flex h-full min-w-0 items-center gap-3 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "measurements" || tab.id === "performance") {
                  setExtraTab(tab.id);
                  return;
                }
                setExtraTab(null);
                setTab(tab.id);
              }}
              className={cn(
                "relative flex h-full items-center border-b-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all",
                (extraTab ? extraTab === tab.id : activeTab === tab.id) 
                  ? "border-[var(--accent)] text-[var(--text-primary)]" 
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {extraTab === null && activeTab === "parameters" && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              {parameters.map((param) => (
                <div key={param.id} className="flex min-w-0 items-center gap-3 rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-2">
                  <span className="w-4 text-[11px] font-semibold text-[var(--text-secondary)]">{param.id}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={0.01}
                    value={param.value}
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
          )}

          {extraTab === null && activeTab === "console" && (
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

          {extraTab === null && activeTab === "diagnostics" && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <DiagnosticStat label="Viewport Mode" value={graphMode.toUpperCase()} />
              <DiagnosticStat label="Objects in Scene" value={String(objectCount)} />
              <DiagnosticStat label="Visible Objects" value={String(visibleCount)} />
              <DiagnosticStat label="Selected ID" value={selectedObjectId?.slice(0, 8) ?? "NONE"} />
            </div>
          )}
          {extraTab === "measurements" && (
            <div className="space-y-2">
              {measurements.length === 0 ? (
                <p className="text-[12px] text-[var(--text-tertiary)]">No measurements recorded.</p>
              ) : (
                measurements.map((measurement) => (
                  <div key={measurement.id} className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2.5 py-2 text-[12px]">
                    <span className="mr-2 font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{measurement.kind}</span>
                    <span className="font-mono text-[var(--text-secondary)]">{measurement.id.slice(0, 12)}</span>
                  </div>
                ))
              )}
            </div>
          )}
          {extraTab === "performance" && (
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
    <div className="flex min-w-0 flex-col gap-1 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</p>
      <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
