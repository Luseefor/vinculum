"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CloseIcon, OrbitAtomIcon } from "@/components/layout/icons";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import AdvancedTab from "@/components/inspector/AdvancedTab";
import AnalysisTab from "@/components/inspector/AnalysisTab";
import AppearanceTab from "@/components/inspector/AppearanceTab";
import ConstraintsTab from "@/components/inspector/ConstraintsTab";
import ObjectTab from "@/components/inspector/ObjectTab";
import { createAndFocus } from "@/lib/objects/objectCreation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";

interface InspectorPanelProps {
  width?: number;
  mode?: "tool" | "object" | "scene";
  activeToolLabel?: string;
  onOpenExamples?: () => void;
  onClose?: () => void;
}

export default function InspectorPanel({
  width,
  mode = "scene",
  activeToolLabel = "Tool",
  onOpenExamples,
  onClose
}: InspectorPanelProps) {
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedIndex = selectedObjectId ? objects.findIndex((object) => object.id === selectedObjectId) : -1;
  const selectedObject = selectedIndex >= 0 ? objects[selectedIndex] : null;
  const selectedMeta = selectedObject ? getObjectRowDisplayMeta(selectedObject) : null;
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const measurementCount = useGraphStore((state) => state.scene.measurements.length);
  const addEmptyObject = useGraphStore((state) => state.addEmptyObject);
  // S30: Object (definition) / Analyze (contextual analysis) / Styles /
  // Links / Adv. Global parameter animation lives in the bottom-dock
  // PARAMETERS tab, not in the per-object Inspector.
  const [tab, setTab] = useState<"object" | "analysis" | "appearance" | "constraints" | "advanced">("object");
  const tabIds = ["object", "analysis", "appearance", "constraints", "advanced"] as const;
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
      focusTab(tabIds[(currentIndex + 1) % tabIds.length] ?? "object");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(tabIds[(currentIndex - 1 + tabIds.length) % tabIds.length] ?? "object");
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab("object");
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab("advanced");
    }
  };

  return (
    <aside
      aria-label="Inspector"
      className="flex h-full shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--editor-chrome)] transition-[width] duration-100 motion-reduce:transition-none"
      style={width ? { width } : undefined}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)]"
            style={selectedObject ? { backgroundColor: `color-mix(in srgb, ${selectedObject.color} 16%, transparent)` } : undefined}
          >
            {selectedObject ? (
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedObject.color }} />
            ) : (
              <OrbitAtomIcon className="h-4 w-4 text-[var(--text-tertiary)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
              {selectedObject && selectedMeta
                ? `${selectedMeta.label} #${selectedIndex + 1}`
                : mode === "tool"
                  ? activeToolLabel
                  : "Scene"}
            </p>
            <p className="truncate text-[12px] text-[var(--text-tertiary)]">
              {selectedObject && selectedMeta
                ? selectedMeta.type
                : mode === "tool"
                  ? "Tool mode · Esc to stop"
                  : `${objectCount} ${objectCount === 1 ? "object" : "objects"} · ${measurementCount} ${measurementCount === 1 ? "measure" : "measures"}`}
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label="Close inspector"
              title="Close inspector"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {mode === "tool" ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-2 text-[12px] text-[var(--accent-ink)]">
            Follow the viewport steps. Press Escape to stop.
          </p>
        ) : null}

        {selectedObject && mode !== "scene" ? (
        <div className="flex min-w-0 gap-0.5 overflow-x-auto rounded-[var(--radius-md)] bg-[var(--surface-muted)] p-0.5" role="tablist" aria-label="Inspector sections" onKeyDown={handleTabListKeyDown}>
          {(
            [
              ["object", "Object"],
              ["analysis", "Analyze"],
              ["appearance", "Styles"],
              ["constraints", "Links"],
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
              aria-controls="graph-inspector"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={cn(
                // S34 PART 35: tabs keep natural width and the row scrolls on
                // compact sheets instead of crushing labels into each other.
                // Object/Analyze stay first in DOM order (always discoverable).
                "h-7 flex-auto shrink-0 rounded-[var(--radius-sm)] px-2 text-[12px] font-medium outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                tab === id
                  ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-control)]"
                  : id === "object" || id === "analysis"
                    ? "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div
          key={`${mode}-${selectedObjectId ?? "none"}`}
          role="tabpanel"
          id="graph-inspector"
          aria-labelledby={`inspector-tab-${tab}`}
          tabIndex={0}
          className="min-w-0 px-4 py-4 outline-none transition-opacity duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          {mode === "scene" || !selectedObjectId ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-transparent">
                <OrbitAtomIcon className="h-4 w-4 text-[var(--accent-ink)]" />
              </div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">No selection</p>
              <p className="mt-1 max-w-[220px] text-[12px] text-[var(--text-tertiary)]">
                Select an object to edit its definition and analysis.
              </p>
              <div className="mt-3 flex w-full max-w-[240px] gap-2">
                <button
                  type="button"
                  onClick={onOpenExamples}
                  className="h-8 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-transparent text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Examples
                </button>
                <button
                  type="button"
                  onClick={() => createAndFocus(() => addEmptyObject())}
                  className="h-8 flex-1 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-soft)] text-[12px] font-medium text-[var(--accent-ink)] outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Add Object
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* S32: tabs mount on demand so selecting an object never starts
                  analysis compute; expression drafts are per-keystroke
                  canonical commits, so Object↔Analyze switches preserve work.
                  (The wrapper above keeps a stable key/id across tab
                  switches to avoid remounting shared chrome.) */}
              {tab === "object" && <ObjectTab />}
              {tab === "analysis" && <AnalysisTab />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "constraints" && <ConstraintsTab />}
              {tab === "advanced" && <AdvancedTab />}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
