"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { OrbitAtomIcon } from "@/components/layout/icons";
import AdvancedTab from "@/components/inspector/AdvancedTab";
import AnimationTab from "@/components/inspector/AnimationTab";
import AppearanceTab from "@/components/inspector/AppearanceTab";
import ConstraintsTab from "@/components/inspector/ConstraintsTab";
import PropertiesTab from "@/components/inspector/PropertiesTab";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

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
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  const [tab, setTab] = useState<"properties" | "appearance" | "constraints" | "animation" | "advanced">("properties");
  const tabIds = ["properties", "appearance", "constraints", "animation", "advanced"] as const;
  type InspectorTabId = (typeof tabIds)[number];
  const tabButtonRefs = useRef<Partial<Record<InspectorTabId, HTMLButtonElement | null>>>({});

  const focusTab = (id: InspectorTabId) => {
    setTab(id);
    tabButtonRefs.current[id]?.focus();
  };

  const handleTabListKeyDown = (event: ReactKeyboardEvent) => {
    const currentIndex = tabIds.indexOf(tab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(tabIds[(currentIndex + 1) % tabIds.length] ?? "properties");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length] ?? "properties");
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab("properties");
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab("advanced");
    }
  };

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
            <p className="font-medium text-[var(--accent-ink)]">{activeToolLabel}</p>
            <p className="text-[var(--text-tertiary)]">Follow viewport steps, then apply or cancel.</p>
            <div className="flex gap-2">
              <button type="button" onClick={onApplyTool} className="h-8 flex-1 rounded-[6px] border border-[var(--accent)] bg-[var(--accent-soft)] text-[12px] font-medium text-[var(--accent-ink)] outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]">
                Apply
              </button>
              <button type="button" onClick={onCancelTool} className="h-8 flex-1 rounded-[6px] border border-[var(--border-subtle)] bg-transparent text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-[var(--border-subtle)]" role="tablist" aria-label="Inspector sections" onKeyDown={handleTabListKeyDown}>
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
              ref={(node) => {
                tabButtonRefs.current[id] = node;
              }}
              role="tab"
              id={`inspector-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`inspector-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={cn(
                "h-8 min-w-[62px] shrink-0 border-b-2 border-transparent px-1.5 text-[11px] font-semibold uppercase tracking-wide outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] active:scale-[0.98]",
                tab === id
                  ? "border-[var(--accent)] text-[var(--accent-ink)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          key={`${mode}-${tab}-${selectedObjectId ?? "none"}`}
          role="tabpanel"
          id={`inspector-panel-${tab}`}
          aria-labelledby={`inspector-tab-${tab}`}
          tabIndex={0}
          className="min-w-0 p-3 outline-none transition-opacity duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          {mode === "scene" || !selectedObjectId ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--border-subtle)] bg-transparent">
                <OrbitAtomIcon className="h-4 w-4 text-[var(--accent-ink)]" />
              </div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Scene Context</p>
              <p className="mt-1 max-w-[220px] text-[12px] text-[var(--text-tertiary)]">
                Select an object or activate a tool to show actionable controls here.
              </p>
              <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                {objectCount} {objectCount === 1 ? "object" : "objects"} · {measurementCount} {measurementCount === 1 ? "measure" : "measures"} · {activeToolLabel}
              </p>
              <div className="mt-3 flex w-full max-w-[240px] gap-2">
                <button
                  type="button"
                  onClick={onOpenExamples}
                  className="h-8 flex-1 rounded-[6px] border border-[var(--border-subtle)] bg-transparent text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Examples
                </button>
                <button
                  type="button"
                  onClick={() => addEmptyObject()}
                  className="h-8 flex-1 rounded-[6px] border border-[var(--accent)] bg-[var(--accent-soft)] text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-ink)] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Add Object
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
