"use client";

import Toolbar from "@/components/layout/Toolbar";
import type { ViewportMode } from "@/lib/types/ui";

interface TopToolbarProps {
  onOpenInspector: () => void;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onDecreaseLeftWidth: () => void;
  onIncreaseLeftWidth: () => void;
  onDecreaseRightWidth: () => void;
  onIncreaseRightWidth: () => void;
  viewportMode: ViewportMode;
  onViewportModeChange: (mode: ViewportMode) => void;
}

export default function TopToolbar(props: TopToolbarProps) {
  const { viewportMode, onViewportModeChange, ...toolbarProps } = props;

  return (
    <div>
      <Toolbar {...toolbarProps} />
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5">
        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-1">
          {(["split", "quad"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewportModeChange(mode)}
              className={[
                "h-6 rounded px-2 text-[10px] font-semibold uppercase tracking-[0.08em]",
                viewportMode === mode
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
              ].join(" ")}
            >
              {mode}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onViewportModeChange("3d")}
            className={[
              "h-6 rounded px-2 text-[10px] font-semibold uppercase tracking-[0.08em]",
              viewportMode === "2d" || viewportMode === "3d"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-tertiary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-secondary)]"
            ].join(" ")}
            aria-label="Single viewport mode"
          >
            single
          </button>
        </div>
      </div>
    </div>
  );
}
