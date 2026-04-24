"use client";

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ open, x, y, onClose }: ContextMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65]" onClick={onClose}>
      <div
        className="absolute min-w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-1 shadow-[var(--shadow-floating)]"
        style={{ left: x, top: y }}
      >
        <button type="button" className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-tertiary)]" disabled>
          Context actions coming soon
        </button>
      </div>
    </div>
  );
}
