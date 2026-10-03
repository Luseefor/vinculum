"use client";

import InspectorPremium from "@/components/editor/InspectorPremium";

interface ContextInspectorDrawerProps {
  open: boolean;
  pinned: boolean;
  width: number;
  onTogglePinned: () => void;
  onClose: () => void;
  onOpenExamples: () => void;
}

export default function ContextInspectorDrawer({
  open,
  pinned,
  width,
  onTogglePinned,
  onClose,
  onOpenExamples
}: ContextInspectorDrawerProps) {
  if (!open) {
    return null;
  }
  return (
    <aside
      className="absolute bottom-2 right-2 top-2 z-30 flex min-h-0 flex-col overflow-hidden max-w-[calc(100%-16px)] rounded-[var(--radius-xl)] bg-[var(--editor-chrome)] shadow-[var(--shadow-floating)]"
      style={{ width: Math.max(296, Math.min(width, 332)) }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      tabIndex={-1}
    >
      <div className="flex h-9 items-center justify-between  px-2 text-[11px]">
        <span className="font-semibold text-[var(--text-secondary)]">Inspector</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePinned}
            className="h-7 rounded border border-transparent px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]"
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded border border-transparent px-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]"
          >
            Close
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <InspectorPremium width={Math.max(296, Math.min(width, 332))} onOpenExamples={onOpenExamples} />
      </div>
    </aside>
  );
}
