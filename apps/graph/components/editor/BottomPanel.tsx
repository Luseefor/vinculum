"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import type { BottomPanelTab } from "@/lib/types/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

const tabs: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "parameters", label: "PARAMETERS" },
  { id: "timeline", label: "TIMELINE" },
  { id: "console", label: "CONSOLE" },
  { id: "diagnostics", label: "DIAGNOSTICS" }
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
  const animation = useEditorStore((state) => state.animation);
  const setAnimationPlaying = useEditorStore((state) => state.setAnimationPlaying);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const visibleCount = useGraphStore((state) => state.scene.objects.filter((object) => object.visible).length);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  
  const [timelineSeconds, setTimelineSeconds] = useState(0);
  const timelineDuration = 300;

  useEffect(() => {
    if (!animation.playing) return;
    const handle = window.setInterval(() => {
      setTimelineSeconds((prev) => (prev + 0.1) % timelineDuration);
    }, 100);
    return () => window.clearInterval(handle);
  }, [animation.playing]);

  return (
    <section
      className={cn(
        "flex flex-col border-t border-[var(--panel-border)] bg-[var(--bg-tertiary)] transition-all duration-300",
        collapsed ? "h-9" : ""
      )}
      style={!collapsed ? { height } : {}}
    >
      <div className="flex h-9 items-center justify-between border-b border-[var(--panel-border)] px-4">
        <div className="flex h-full items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "h-full border-b-2 text-[10px] font-bold tracking-widest transition-all",
                activeTab === tab.id 
                  ? "border-[var(--accent)] text-[var(--text-primary)]" 
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {!collapsed && (
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Timeline</p>
               <div className="flex items-center gap-1">
                 <button onClick={() => setAnimationPlaying(!animation.playing)} className="text-[10px] font-bold text-[var(--accent)] hover:underline uppercase">
                   {animation.playing ? "Stop" : "Play"}
                 </button>
                 <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-2">
                   {formatTimelineTime(timelineSeconds)}
                 </span>
               </div>
             </div>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {activeTab === "parameters" && (
            <div className="grid grid-cols-1 gap-x-12 gap-y-4 md:grid-cols-2">
              {parameters.map((param) => (
                <div key={param.id} className="flex items-center gap-4">
                  <span className="w-4 text-[11px] font-bold text-[var(--text-secondary)]">{param.id}</span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={0.01}
                    value={param.value}
                    onChange={(e) => setParameterValue(param.id, Number(e.target.value))}
                    className="flex-1 accent-[var(--accent)] h-1 rounded-full bg-[var(--surface-muted)] appearance-none cursor-pointer"
                  />
                  <span className="w-12 text-right font-mono text-[11px] font-bold text-[var(--text-primary)]">
                    {param.value.toFixed(2)}
                  </span>
                </div>
              ))}
              {parameters.length === 0 && (
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] italic">No parameters defined.</p>
              )}
            </div>
          )}

          {activeTab === "console" && (
            <div className="flex flex-col gap-1.5 font-mono text-[10px] pr-1">
              {consoleEvents.map((ev, i) => (
                <div key={i} className="flex gap-2 border-b border-[var(--border-subtle)] pb-1">
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
          
          {activeTab === "timeline" && (
             <div className="flex flex-col gap-4">
                <div className="h-8 w-full bg-[var(--bg-primary)] rounded-md border border-[var(--border-strong)] relative overflow-hidden">
                   <div 
                     className="absolute top-0 left-0 h-full bg-[var(--accent)]/10 border-r border-[var(--accent)] transition-all"
                     style={{ width: `${(timelineSeconds / timelineDuration) * 100}%` }}
                   />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
                   <span>00:00</span>
                   <span>05:00</span>
                </div>
             </div>
          )}
        </div>
      )}
    </section>
  );
}

function DiagnosticStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] shadow-sm">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">{label}</p>
      <p className="text-[11px] font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function formatTimelineTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
