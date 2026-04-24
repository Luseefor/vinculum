"use client";

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

const ITEMS: Array<{ id: string; label: string; disabled?: boolean }> = [
  { id: "add-surface", label: "Add Surface" },
  { id: "add-curve", label: "Add Parametric Curve" },
  { id: "add-plane", label: "Add Plane" },
  { id: "separator-1", label: "", disabled: true },
  { id: "toggle-2d", label: "Switch to 2D" },
  { id: "toggle-3d", label: "Switch to 3D" },
  { id: "switch-split", label: "Switch to Split View" },
  { id: "separator-2", label: "", disabled: true },
  { id: "reset-view", label: "Reset View" },
  { id: "delete-selected", label: "Delete Selected" }
];

export default function ContextMenu({ open, x, y, onClose, onRunCommand }: ContextMenuProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65]" onClick={onClose}>
      <div
        className="absolute min-w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-1 shadow-[var(--shadow-floating)]"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        {ITEMS.map((item) => {
          if (item.id.startsWith("separator")) {
            return <div key={item.id} className="my-1 h-px bg-[var(--border-subtle)]" />;
          }
          return (
            <button
              key={item.id}
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
              onClick={() => {
                onRunCommand(item.id);
                onClose();
              }}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
