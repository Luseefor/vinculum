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
  const animation = useEditorStore((state) => state.animation);
  const setAnimationPlaying = useEditorStore((state) => state.setAnimationPlaying);
  const setAnimationSpeed = useEditorStore((state) => state.setAnimationSpeed);
  const setAnimationRange = useEditorStore((state) => state.setAnimationRange);
  const setAnimationParameterId = useEditorStore((state) => state.setAnimationParameterId);
  const toggleAnimationLoop = useEditorStore((state) => state.toggleAnimationLoop);
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
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <DiagnosticCard label="Target" value={animation.parameterId ?? "None"} />
                <DiagnosticCard label="State" value={animation.playing ? "PLAYING" : "PAUSED"} />
              </div>
              <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-2">
                <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Parameter</span>
                    <select
                      value={animation.parameterId ?? ""}
                      onChange={(event) => setAnimationParameterId(event.target.value || null)}
                      className="h-8 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 text-[11px] text-[var(--text-primary)]"
                    >
                      <option value="">None</option>
                      {parameters.map((parameter) => (
                        <option key={parameter.id} value={parameter.id}>
                          {parameter.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button type="button" size="sm" variant="ghost" onClick={toggleAnimationLoop}>
                      Loop: {animation.loop ? "On" : "Off"}
                    </Button>
                  </div>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setAnimationPlaying(!animation.playing)}>
                    {animation.playing ? "Pause" : "Play"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAnimationPlaying(false)}>
                    Stop
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Speed</span>
                    <input
                      type="range"
                      min={0.05}
                      max={8}
                      step={0.05}
                      value={animation.speed}
                      onChange={(event) => setAnimationSpeed(Number(event.target.value))}
                      className="resolution-slider"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Min</span>
                    <input
                      type="number"
                      value={animation.min}
                      onChange={(event) => setAnimationRange(Number(event.target.value), animation.max)}
                      className="h-8 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 font-mono text-[11px]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Max</span>
                    <input
                      type="number"
                      value={animation.max}
                      onChange={(event) => setAnimationRange(animation.min, Number(event.target.value))}
                      className="h-8 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 font-mono text-[11px]"
                    />
                  </label>
                </div>
              </div>
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
