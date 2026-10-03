"use client";

import { useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CloseIcon, EyeIcon, EyeOffIcon, OrbitAtomIcon } from "@/components/layout/icons";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import AdvancedTab from "@/components/inspector/AdvancedTab";
import AnalysisTab from "@/components/inspector/AnalysisTab";
import AppearanceTab from "@/components/inspector/AppearanceTab";
import ConstraintsTab from "@/components/inspector/ConstraintsTab";
import ObjectTab from "@/components/inspector/ObjectTab";
import { createAndFocus } from "@/lib/objects/objectCreation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/styles";
import { useEditorStore } from "@/lib/store/editorStore";
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
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const constraints = useEditorStore((state) => state.constraints);
  // Primary workflows stay visible; occasional object tools belong in Settings.
  const [tab, setTab] = useState<"object" | "analysis" | "appearance">("object");
  const tabIds = ["object", "analysis", "appearance"] as const;
  const hasSelection = Boolean(selectedObject && mode !== "scene");
  const canShowLinks = objects.length > 1 || constraints.some((constraint) => constraint.objectIds.includes(selectedObjectId ?? ""));
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
      focusTab("appearance");
    }
  };

  return (
    <aside
      aria-label="Inspector"
      className="inspector-panel flex h-full min-w-0 max-w-full shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--editor-chrome)] transition-[width] duration-100 motion-reduce:transition-none"
      style={{ width: width ?? "100%" }}
    >
      <div className="flex flex-col gap-4 px-4 pb-3 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-muted)]"
            style={selectedObject ? { backgroundColor: `color-mix(in srgb, ${selectedObject.color} 16%, transparent)` } : undefined}
          >
            {selectedObject ? (
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedObject.color }} />
            ) : (
              <OrbitAtomIcon className="h-4 w-4 text-[var(--text-tertiary)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">
              {selectedObject && selectedMeta
                ? `${selectedMeta.label} #${selectedIndex + 1}`
                : mode === "tool"
                  ? activeToolLabel
                  : "Scene"}
            </h2>
            <p className="truncate text-[12px] text-[var(--text-tertiary)]">
              {selectedObject && selectedMeta
                ? `${objectKindLabel(selectedObject.kind)}${selectedObject.visible ? "" : " · Hidden"}`
                : mode === "tool"
                  ? "Tool mode · Esc to stop"
                  : `${objectCount} ${objectCount === 1 ? "object" : "objects"} · ${measurementCount} ${measurementCount === 1 ? "measure" : "measures"}`}
            </p>
          </div>
          {hasSelection && selectedObject ? (
            <button type="button" className="inspector-icon-button" aria-label={selectedObject.visible ? "Hide selected object" : "Show selected object"}
              aria-pressed={selectedObject.visible} title={selectedObject.visible ? "Hide from graph" : "Show on graph"}
              onClick={() => toggleObjectVisibility(selectedObject.id)}>
              {selectedObject.visible ? <EyeIcon className="h-4 w-4" /> : <EyeOffIcon className="h-4 w-4" />}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              aria-label="Close inspector"
              title="Close inspector"
              onClick={onClose}
              className="inspector-icon-button"
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

        {hasSelection ? (
        <div className="inspector-tabs" role="tablist" aria-label="Inspector sections" onKeyDown={handleTabListKeyDown}>
          {(
            [
              ["object", "Edit"],
              ["analysis", "Analyze"],
              ["appearance", "Settings"]
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
              className={cn("inspector-tab", tab === id && "inspector-tab-active")}
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
          role={hasSelection ? "tabpanel" : undefined}
          id="graph-inspector"
          aria-labelledby={hasSelection ? `inspector-tab-${tab}` : undefined}
          tabIndex={0}
          className="min-w-0 px-4 py-4 outline-none transition-opacity duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
        >
          {!hasSelection || !selectedObject ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center px-4 text-center">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-transparent">
                <OrbitAtomIcon className="h-4 w-4 text-[var(--accent-ink)]" />
              </div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">No selection</p>
              <p className="mt-1 max-w-[220px] text-[12px] text-[var(--text-tertiary)]">
                Select an object to edit its definition and analysis.
              </p>
              <div className="mt-3 flex w-full max-w-[240px] gap-2">
                {onOpenExamples ? <button
                  type="button"
                  onClick={onOpenExamples}
                  className="h-8 flex-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-transparent text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  Examples
                </button> : null}
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
              {tab === "analysis" && <>
                <p className="inspector-section-help">{analysisHelp(selectedObject.kind)}</p>
                <AnalysisTab />
              </>}
              {tab === "appearance" && <>
                <AppearanceTab />
                {canShowLinks ? <InspectorDisclosure title="Object links"><ConstraintsTab /></InspectorDisclosure> : null}
                <InspectorDisclosure title="Object data"><AdvancedTab /></InspectorDisclosure>
              </>}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}


function InspectorDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="inspector-disclosure" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary>
    {open ? <div className="pt-3">{children}</div> : null}
  </details>;
}

function objectKindLabel(kind: string): string {
  return ({ surface: "Explicit surface", implicitSurface: "Implicit surface", parametricCurve: "Parametric curve", parametricSurface: "Parametric surface", vectorField: "Vector field", linearTransform: "Linear transformation", plane: "Plane", point: "Point", vector: "Vector", line: "Line", ray: "Ray", segment: "Segment" } as Record<string, string>)[kind] ?? "Selected object";
}

function analysisHelp(kind: string): string {
  if (kind === "surface") return "Gradient, Laplacian, field colors and integrals.";
  if (kind === "implicitSurface") return "Gradient, normals and field colors.";
  if (kind === "vectorField") return "Divergence, curl, field direction and streamlines.";
  if (kind === "parametricCurve") return "Arc length and line integrals.";
  if (kind === "parametricSurface") return "Surface area and surface integrals.";
  if (kind === "linearTransform") return "Determinant, inverse, rank and eigendirections.";
  return "Measurements and geometric properties of this object.";
}
