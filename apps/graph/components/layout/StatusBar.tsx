"use client";

import { useState } from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { DOCK_TABS } from "@/components/editor/BottomPanel";
import type { BottomPanelTab } from "@/lib/types/ui";
import { cn } from "@/components/ui/styles";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "@/components/layout/icons";

// Parameters (sliders) and Measurements are user-facing math panels and stay
// one click away in the bar; Console/Diagnostics/Performance are inspection
// tools and live behind "More".
const PRIMARY_TABS: readonly BottomPanelTab[] = ["parameters", "measurements"];

const TAB_CLASS =
  "h-6 shrink-0 rounded-[var(--radius-sm)] px-2 text-[12px] font-medium outline-none transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

export default function StatusBar() {
  const dockCollapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const setDockCollapsed = useEditorStore((state) => state.setBottomPanelCollapsed);
  const dockTab = useEditorStore((state) => state.bottomPanelTab);
  const setDockTab = useEditorStore((state) => state.setBottomPanelTab);
  const [moreOpen, setMoreOpen] = useState(false);

  const openTab = (tab: BottomPanelTab) => {
    if (!dockCollapsed && dockTab === tab) {
      setDockCollapsed(true);
      return;
    }
    setDockTab(tab);
    setDockCollapsed(false);
  };

  const primary = DOCK_TABS.filter((tab) => PRIMARY_TABS.includes(tab.id));
  const secondary = DOCK_TABS.filter((tab) => !PRIMARY_TABS.includes(tab.id));
  const activeSecondary = !dockCollapsed ? secondary.find((tab) => tab.id === dockTab) : undefined;

  return (
    <footer className="flex h-8 shrink-0 items-center gap-0.5 border-t border-[var(--border-subtle)] bg-[var(--editor-chrome)] px-2 text-[12px] text-[var(--text-tertiary)]">
      <nav aria-label="Bottom panel" className="flex min-w-0 items-center gap-0.5">
        {[...primary, ...(activeSecondary ? [activeSecondary] : [])].map((tab) => {
          const active = !dockCollapsed && dockTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => openTab(tab.id)}
              className={cn(
                TAB_CLASS,
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
      <div className="relative">
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger>
            {(props) => (
              <button
                ref={props.ref as never}
                type="button"
                aria-label="More panels"
                aria-expanded={props["aria-expanded"]}
                aria-controls={props["aria-controls"]}
                aria-haspopup={props["aria-haspopup"]}
                onClick={props.onClick}
                onKeyDown={props.onKeyDown}
                className={cn(
                  TAB_CLASS,
                  "flex items-center gap-1",
                  moreOpen
                    ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                More
                <ChevronDownIcon className="h-3 w-3 rotate-180" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bottom-full mb-2 mt-0" sideOffset={0}>
            {secondary.map((tab) => (
              <DropdownMenuItem
                key={tab.id}
                onSelect={() => {
                  setDockTab(tab.id);
                  setDockCollapsed(false);
                  setMoreOpen(false);
                }}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </footer>
  );
}
