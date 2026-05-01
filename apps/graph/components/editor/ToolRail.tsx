"use client";

import { cn } from "@/components/ui/styles";
import { CursorArrowIcon, SearchIcon, EyeIcon, LockIcon, ConnectorIcon, SlidersIcon } from "@/components/layout/icons";
import type { ReactNode } from "react";

type ToolId = "pan" | "probe" | "measureDistance" | "measureAngle" | "addPin" | "draw";

interface ToolRailProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
  onResetView: () => void;
}

const TOOL_ITEMS: Array<{ id: ToolId; label: string; icon: ReactNode }> = [
  { id: "probe", label: "Select", icon: <CursorArrowIcon className="h-3.5 w-3.5" /> },
  { id: "pan", label: "Pan", icon: <SearchIcon className="h-3.5 w-3.5" /> },
  { id: "probe", label: "Probe", icon: <EyeIcon className="h-3.5 w-3.5" /> },
  { id: "addPin", label: "Pin", icon: <LockIcon className="h-3.5 w-3.5" /> },
  { id: "measureDistance", label: "Distance", icon: <ConnectorIcon className="h-3.5 w-3.5" /> },
  { id: "measureAngle", label: "Angle", icon: <SlidersIcon className="h-3.5 w-3.5" /> },
  { id: "draw", label: "Sketch", icon: <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 11.5 11.8 2.2l2 2-9.3 9.3-2.5.3z" /></svg> }
];

export default function ToolRail({ activeTool, onSelectTool, onResetView }: ToolRailProps) {
  return (
    <aside className="flex h-full w-14 shrink-0 flex-col border-r border-[var(--border-strong)] bg-[var(--editor-chrome)]">
      <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5 py-2">
        {TOOL_ITEMS.map((tool, index) => (
          <button
            key={`${tool.label}-${index}`}
            type="button"
            onClick={() => onSelectTool(tool.id)}
            title={tool.label}
            className={cn(
              "group relative flex h-9 w-9 items-center justify-center rounded-md border text-[11px] font-semibold outline-none transition-all duration-100 motion-reduce:transition-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
              activeTool === tool.id
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_2px_0_0_var(--accent)]"
                : "border-[var(--border-subtle)] bg-[var(--editor-control)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            )}
            aria-label={tool.label}
            aria-pressed={activeTool === tool.id}
          >
            {tool.icon}
          </button>
        ))}
      </div>
      <div className="border-t border-[var(--border-strong)] p-1.5">
        <button
          type="button"
          onClick={onResetView}
          className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--editor-control)] text-[11px] font-medium text-[var(--text-secondary)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        >
          <span className="sr-only">Reset</span>
          <svg viewBox="0 0 16 16" className="mx-auto h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 8a5 5 0 1 0 1.4-3.5" />
            <path d="M2.5 3.5h2.8v2.8" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
