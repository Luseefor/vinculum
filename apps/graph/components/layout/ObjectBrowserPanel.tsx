"use client";

import { useEffect, useRef, useState } from "react";
import ObjectTree from "@/components/objects/ObjectTree";
import AddObjectMenu from "@/components/objects/AddObjectMenu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/lib/store/editorStore";
import { createObjectByKey } from "@/lib/objects/objectCreation";
import { moreAddDescriptors, quickAddDescriptors } from "@/lib/objects/objectDescriptors";
import { useGraphStore } from "@/store/graphStore";
import { SearchIcon } from "@/components/layout/icons";
import { formatMeasurementValue } from "@/lib/measurements/measurementMath";

export const OBJECT_SEARCH_OPEN_EVENT = "vinculum:open-object-search";
const FINDER_MIN_OBJECTS = 6;

interface ObjectBrowserPanelProps {
  width: number;
}

export default function ObjectBrowserPanel({ width }: ObjectBrowserPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "objects" | "measurements" | "visible">("all");
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const measurements = useGraphStore((state) => state.scene.measurements);
  const selectedMeasurementId = useGraphStore((state) => state.ui.selectedMeasurementId);
  const removeMeasurement = useGraphStore((state) => state.removeMeasurement);
  const selectMeasurement = useGraphStore((state) => state.selectMeasurement);
  const workspace = useGraphStore((state) => state.ui.workspace);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);
  const [showMoreAdd, setShowMoreAdd] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingSearchFocus = useRef(false);
  // Search and filters only earn space once the list is long enough to need
  // them; below that they stay one click (or "/") away.
  const showFinder =
    searchOpen || objectCount >= FINDER_MIN_OBJECTS || searchQuery !== "" || filter !== "all";

  useEffect(() => {
    const open = () => {
      pendingSearchFocus.current = true;
      setSearchOpen(true);
      searchInputRef.current?.focus();
    };
    window.addEventListener(OBJECT_SEARCH_OPEN_EVENT, open);
    return () => window.removeEventListener(OBJECT_SEARCH_OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (showFinder && pendingSearchFocus.current) {
      pendingSearchFocus.current = false;
      searchInputRef.current?.focus();
    }
  }, [showFinder]);

  const quickDescriptors = quickAddDescriptors(workspace);
  const moreDescriptors = moreAddDescriptors(workspace);

  const chipClass =
    "h-7 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 text-[12px] font-medium text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] motion-reduce:transition-none hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.98]";

  return (
    <aside
      aria-label="Scene Navigator"
      className="flex h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--editor-chrome)] transition-[width] duration-100 motion-reduce:transition-none"
      style={{ width }}
    >
      <div className="flex flex-col gap-3 px-3 pb-3 pt-4">
        <div className="flex items-center gap-2 px-1">
          <p className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Objects</p>
          <span
            data-testid="scene-object-count"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--surface-muted)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]"
          >
            {objectCount}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            {!showFinder ? (
              <button
                type="button"
                aria-label="Search objects"
                title="Search objects (/)"
                onClick={() => {
                  pendingSearchFocus.current = true;
                  setSearchOpen(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <SearchIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {/* S30: the complete categorized catalog lives in AddObjectMenu. */}
            <AddObjectMenu />
          </div>
        </div>

        {showFinder ? (
        <>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            id="object-search-input"
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearchQuery("");
                setSearchOpen(false);
              }
            }}
            placeholder="Search objects"
            aria-label="Search objects"
            className="h-9 w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--surface-muted)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:bg-[var(--surface-raised)]"
          />
        </div>
        <div className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Object list filter">
          {(["all", "objects", "measurements", "visible"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`h-7 shrink-0 whitespace-nowrap rounded-full px-2 text-[12px] font-medium capitalize outline-none transition-colors duration-100 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${filter === key ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"}`}
            >
              {key}
            </button>
          ))}
        </div>
        </>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
        {(filter === "all" || filter === "objects" || filter === "visible") && (
          <ObjectTree filterQuery={searchQuery} visibleOnly={filter === "visible"} />
        )}
        {filter === "measurements" || (filter === "all" && measurements.length > 0) ? (
          <section className={filter === "all" ? "mt-4 space-y-1" : "space-y-1"} aria-label="Measurements">
            <p className="px-2 pb-1 text-[12px] font-medium text-[var(--text-tertiary)]">Measurements</p>
            {measurements.length === 0 ? (
              <p className="px-2 py-2 text-[12px] text-[var(--text-tertiary)]">No measurements yet.</p>
            ) : (
              measurements.map((measurement) => {
                const isSelected = selectedMeasurementId === measurement.id;
                return (
                  <div
                    key={measurement.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-[12px] ${isSelected ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectMeasurement(measurement.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Delete" || event.key === "Backspace") {
                          event.preventDefault();
                          removeMeasurement(measurement.id);
                          addConsoleEvent(`Deleted measurement ${measurement.kind}`);
                        }
                      }}
                      className="min-w-0 truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <span className="mr-1.5 text-[11px] capitalize text-[var(--text-tertiary)]">{measurement.kind}</span>
                      <span className="truncate font-medium">{formatMeasurementValue(measurement)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete measurement ${measurement.kind}`}
                      onClick={() => {
                        removeMeasurement(measurement.id);
                        addConsoleEvent(`Deleted measurement ${measurement.kind}`);
                      }}
                      className="h-6 rounded-[var(--radius-sm)] px-2 text-[11px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    >
                      Delete
                    </button>
                  </div>
                );
              })
            )}
          </section>
        ) : null}
      </ScrollArea>

      <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2.5">
        <p className="mb-2 px-1 text-[12px] font-medium text-[var(--text-tertiary)]">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {quickDescriptors.map((item) => (
            <button key={item.key} type="button" onClick={() => createObjectByKey(item.key)} className={chipClass}>
              {item.label}
            </button>
          ))}
          {showMoreAdd
            ? moreDescriptors.map((item) => (
                <button key={item.key} type="button" onClick={() => createObjectByKey(item.key)} className={chipClass}>
                  {item.label}
                </button>
              ))
            : null}
          <button
            type="button"
            onClick={() => setShowMoreAdd((value) => !value)}
            aria-label={showMoreAdd ? "Show fewer object types" : "Show more object types"}
            aria-expanded={showMoreAdd}
            className="h-7 rounded-full px-2.5 text-[12px] font-medium text-[var(--accent-ink)] outline-none transition-colors hover:bg-[var(--accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            {showMoreAdd ? "Less" : "More…"}
          </button>
        </div>
      </div>
    </aside>
  );
}
