"use client";

import { useEditorStore } from "@/lib/store/editorStore";
import type { BottomPanelTab } from "@/lib/types/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

const tabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "parameters", label: "Parameters" },
  { id: "timeline", label: "Timeline" },
  { id: "console", label: "Console" },
  { id: "diagnostics", label: "Diagnostics" }
];

export default function BottomPanel() {
  const collapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const height = useEditorStore((state) => state.bottomPanelHeight);
  const activeTab = useEditorStore((state) => state.bottomPanelTab);
  const toggle = useEditorStore((state) => state.toggleBottomPanel);
  const setTab = useEditorStore((state) => state.setBottomPanelTab);
  const parameters = useEditorStore((state) => state.parameters);
  const setParameterValue = useEditorStore((state) => state.setParameterValue);
  const consoleEvents = useEditorStore((state) => state.consoleEvents);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => state.scene.objects.filter((object) => object.visible).length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);

  return (
    <section className="border-t border-[var(--border-subtle)] bg-[var(--surface-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-1.5">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              className={cn("h-7", activeTab === tab.id ? "font-semibold" : "")}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={toggle}>
          {collapsed ? "Expand" : "Collapse"}
        </Button>
      </div>
      {!collapsed ? (
        <div className="overflow-auto px-3 py-2 text-[11px] text-[var(--text-tertiary)]" style={{ height }}>
          {activeTab === "parameters" && (
            <div className="space-y-2">
              {parameters.map((parameter) => (
                <div
                  key={parameter.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1.5"
                >
                  <span className="font-mono text-[11px] text-[var(--text-primary)]">{parameter.id}</span>
                  <input
                    type="range"
                    min={parameter.min}
                    max={parameter.max}
                    step={0.1}
                    value={parameter.value}
                    onChange={(event) => setParameterValue(parameter.id, Number(event.target.value))}
                    className="resolution-slider"
                  />
                  <span className="w-12 text-right font-mono text-[10px] text-[var(--text-secondary)]">
                    {parameter.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {activeTab === "timeline" && (
            <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2">
              Timeline controls are queued for a dedicated animation checkpoint.
            </div>
          )}
          {activeTab === "console" && (
            <div className="space-y-1">
              {consoleEvents.length === 0 ? (
                <p className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2">
                  No events yet.
                </p>
              ) : (
                consoleEvents.map((eventText, index) => (
                  <p
                    key={`${eventText}-${index}`}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-[10px]"
                  >
                    {eventText}
                  </p>
                ))
              )}
            </div>
          )}
          {activeTab === "diagnostics" && (
            <div className="grid grid-cols-2 gap-2">
              <DiagnosticCard label="Mode" value={graphMode.toUpperCase()} />
              <DiagnosticCard label="Objects" value={`${objectCount}`} />
              <DiagnosticCard label="Visible" value={`${visibleCount}`} />
              <DiagnosticCard label="Selected" value={selectedObjectId ? selectedObjectId.slice(0, 8) : "None"} />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 font-mono text-[11px] text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
