"use client";

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentMode: "2d" | "3d" | "split" | "quad";
}

type ContextItem = { id: string; label: string; disabled?: boolean };

function buildItems({
  hasSelection,
  canUndo,
  canRedo,
  currentMode
}: Pick<ContextMenuProps, "hasSelection" | "canUndo" | "canRedo" | "currentMode">): ContextItem[] {
  return [
    { id: "add-surface", label: "Add Surface" },
    { id: "add-curve", label: "Add Parametric Curve" },
    { id: "add-plane", label: "Add Plane" },
    { id: "separator-1", label: "", disabled: true },
    { id: "toggle-2d", label: currentMode === "2d" ? "2D Active" : "Switch to 2D", disabled: currentMode === "2d" },
    { id: "toggle-3d", label: currentMode === "3d" ? "3D Active" : "Switch to 3D", disabled: currentMode === "3d" },
    {
      id: "switch-split",
      label: currentMode === "split" ? "Split Active" : "Switch to Split View",
      disabled: currentMode === "split"
    },
    {
      id: "switch-quad",
      label: currentMode === "quad" ? "Quad Active" : "Switch to Quad View",
      disabled: currentMode === "quad"
    },
    { id: "separator-2", label: "", disabled: true },
    { id: "undo", label: "Undo", disabled: !canUndo },
    { id: "redo", label: "Redo", disabled: !canRedo },
    { id: "reset-view", label: "Reset View" },
    { id: "delete-selected", label: hasSelection ? "Delete Selected" : "Delete Selected (None)", disabled: !hasSelection }
  ];
}

export default function ContextMenu({
  open,
  x,
  y,
  onClose,
  onRunCommand,
  hasSelection,
  canUndo,
  canRedo,
  currentMode
}: ContextMenuProps) {
  if (!open) {
    return null;
  }
  const items = buildItems({ hasSelection, canUndo, canRedo, currentMode });

  return (
    <div className="fixed inset-0 z-[65]" onClick={onClose}>
      <div
        className="absolute min-w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-1 shadow-[var(--shadow-floating)]"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => {
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
