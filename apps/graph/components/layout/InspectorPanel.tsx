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

interface InspectorPanelProps {
  width?: number;
}

export default function InspectorPanel({ width }: InspectorPanelProps) {
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const [tab, setTab] = useState<"properties" | "appearance" | "constraints" | "animation" | "advanced">("properties");

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-l border-[var(--panel-border)] bg-[var(--bg-tertiary)]"
      style={width ? { width } : undefined}
    >
      <div className="flex flex-col gap-3 px-4 py-4 border-b border-[var(--panel-border)]">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Inspector</p>
          {selectedObjectId && (
            <span className="text-[9px] font-bold tracking-tight text-[var(--text-tertiary)] uppercase">
              {selectedObjectId.slice(0, 8)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-primary)] p-1 shadow-sm">
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
                "flex-1 h-7 rounded-md text-[10px] font-bold transition-all",
                tab === id
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {!selectedObjectId ? (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--accent)]/30 bg-[var(--accent-soft)]">
                <OrbitAtomIcon className="h-8 w-8 text-[var(--accent)]" />
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">No Selection</p>
              <p className="mt-2 max-w-[180px] text-[11px] font-medium leading-relaxed text-[var(--text-tertiary)]">
                Select an object from the scene to view and edit its properties.
              </p>
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
