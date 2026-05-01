"use client";

import { useState } from "react";
import { OrbitAtomIcon } from "@/components/layout/icons";
import AdvancedTab from "@/components/inspector/AdvancedTab";
import AnimationTab from "@/components/inspector/AnimationTab";
import AppearanceTab from "@/components/inspector/AppearanceTab";
import ConstraintsTab from "@/components/inspector/ConstraintsTab";
import PropertiesTab from "@/components/inspector/PropertiesTab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";

interface InspectorPanelProps {
  width?: number;
  mode?: "tool" | "object" | "scene";
  activeToolLabel?: string;
  onApplyTool?: () => void;
  onCancelTool?: () => void;
  onOpenExamples?: () => void;
}

export default function InspectorPanel({
  width,
  mode = "scene",
  activeToolLabel = "Tool",
  onApplyTool,
  onCancelTool,
  onOpenExamples
}: InspectorPanelProps) {
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const measurementCount = useGraphStore((state) => state.scene.measurements.length);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const viewportMode = useEditorStore((state) => state.viewportMode);
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const [tab, setTab] = useState<"properties" | "appearance" | "constraints" | "animation" | "advanced">("properties");

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-l border-[var(--border-strong)] bg-[var(--editor-chrome)] transition-[width] duration-100 motion-reduce:transition-none"
      style={width ? { width } : undefined}
    >
      <div className="flex flex-col gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {mode === "tool" ? "Tool Mode" : mode === "object" ? "Object Mode" : "Scene Mode"}
          </p>
          {selectedObjectId && (
            <span className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-tertiary)]">
              {selectedObjectId.slice(0, 8)}
            </span>
          )}
        </div>

        {mode === "tool" ? (
          <div className="space-y-2 rounded-[6px] border border-[var(--border-subtle)] bg-transparent p-2 text-[12px]">
            <p className="font-medium text-[var(--accent)]">{activeToolLabel}</p>
            <p className="text-[var(--text-tertiary)]">Follow viewport steps, then apply or cancel.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onApplyTool} className="h-8 flex-1 rounded-[6px] border border-[var(--accent)] bg-[var(--accent-soft)] text-[12px] font-medium text-[var(--accent)] outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]">
                Apply
              </button>
              <button type="button" onClick={onCancelTool} className="h-8 flex-1 rounded-[6px] border border-[var(--border-subtle)] bg-transparent text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
          {(
            [
              ["properties", "Props"],
              ["appearance", "Styles"],
              ["constraints", "Links"],
              ["animation", "Anim"],
              ["advanced", "Adv"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "h-8 min-w-[62px] shrink-0 border-b-2 border-transparent px-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-100 motion-reduce:transition-none active:scale-[0.98]",
                tab === id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div key={`${mode}-${tab}-${selectedObjectId ?? "none"}`} className="min-w-0 p-3 transition-opacity duration-100 motion-reduce:transition-none">
          {mode === "scene" || !selectedObjectId ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--border-subtle)] bg-transparent">
                <OrbitAtomIcon className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">Scene Context</p>
              <p className="mt-1 max-w-[220px] text-[13px] text-[var(--text-tertiary)]">
                Select an object or activate a tool to show actionable controls here.
              </p>
              <div className="mt-4 grid w-full max-w-[240px] grid-cols-2 gap-2 text-left">
                <SceneStat label="Objects" value={String(objectCount)} />
                <SceneStat label="Measures" value={String(measurementCount)} />
                <SceneStat label="Tool" value={activeToolLabel} />
                <SceneStat label="View" value={`${graphMode.toUpperCase()} · ${viewportMode.toUpperCase()}`} />
              </div>
              <div className="mt-3 flex w-full max-w-[240px] gap-2">
                <button
                  type="button"
                  onClick={onOpenExamples}
                  className="h-8 flex-1 rounded-[6px] border border-[var(--border-subtle)] bg-transparent text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Examples
                </button>
                <button
                  type="button"
                  onClick={() => addEmptyObject()}
                  className="h-8 flex-1 rounded-[6px] border border-[var(--accent)] bg-[var(--accent-soft)] text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]"
                >
                  Add Object
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {tab === "properties" && <PropertiesTab />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "constraints" && <ConstraintsTab />}
              {tab === "animation" && <AnimationTab />}
              {tab === "advanced" && <AdvancedTab />}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function SceneStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-[var(--border-subtle)] bg-transparent px-2 py-1">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</p>
      <p className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
