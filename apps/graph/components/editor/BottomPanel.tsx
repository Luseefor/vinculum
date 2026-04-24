"use client";

import { useEditorStore } from "@/lib/store/editorStore";
import type { BottomPanelTab } from "@/lib/types/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/styles";

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
        <div className="px-3 py-2 text-[11px] text-[var(--text-tertiary)]" style={{ height }}>
          {activeTab === "parameters" && "Global parameters panel (Slice 11)."}
          {activeTab === "timeline" && "Timeline controls (Slice 11)."}
          {activeTab === "console" && "Editor console events (Slice 11)."}
          {activeTab === "diagnostics" && "Render and sampling diagnostics (Slice 11)."}
        </div>
      ) : null}
    </section>
  );
}
