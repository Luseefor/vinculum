"use client";

import { useState } from "react";
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
      className="flex h-full shrink-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--surface-bg)]"
      style={width ? { width } : undefined}
    >
      <div className="border-b border-[var(--border-subtle)] px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Inspector</p>
          {selectedObjectId ? (
            <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedObjectId.slice(0, 8)}</span>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1">
          {(
            [
              ["properties", "Props"],
              ["appearance", "Style"],
              ["constraints", "Links"],
              ["animation", "Anim"],
              ["advanced", "Adv"]
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "h-6 rounded text-[10px] font-semibold",
                tab === id
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-2.5">
        {tab === "properties" && <PropertiesTab />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "constraints" && <ConstraintsTab />}
        {tab === "animation" && <AnimationTab />}
        {tab === "advanced" && (
          <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/30 p-3">
            <h3 className="text-[11px] font-semibold text-[var(--text-primary)]">Advanced</h3>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Diagnostics and object internals land in a later checkpoint.</p>
          </section>
        )}
      </ScrollArea>
    </aside>
  );
}
