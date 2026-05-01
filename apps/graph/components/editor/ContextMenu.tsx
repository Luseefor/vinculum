"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  currentMode: "2d" | "3d" | "split" | "quad";
}

type ContextItem = { id: string; label: string; disabled?: boolean };

function buildItems({
  hasSelection,
  canUndo,
  canRedo,
  snapEnabled,
  currentMode
}: Pick<ContextMenuProps, "hasSelection" | "canUndo" | "canRedo" | "snapEnabled" | "currentMode">): ContextItem[] {
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
    { id: "toggle-snap", label: `Snap: ${snapEnabled ? "On" : "Off"}` },
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
  snapEnabled,
  currentMode
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const PADDING = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = menuRef.current?.getBoundingClientRect();
    const menuWidth = rect?.width ?? 240;
    const menuHeight = rect?.height ?? 340;

    const clampedX = Math.min(Math.max(x, PADDING), Math.max(PADDING, viewportWidth - menuWidth - PADDING));
    const clampedY = Math.min(Math.max(y, PADDING), Math.max(PADDING, viewportHeight - menuHeight - PADDING));

    setPosition({ x: clampedX, y: clampedY });
  }, [open, x, y, hasSelection, canUndo, canRedo, snapEnabled, currentMode]);

  if (!open) {
    return null;
  }
  const items = buildItems({ hasSelection, canUndo, canRedo, snapEnabled, currentMode });

  return (
    <div className="fixed inset-0 z-[65]" onClick={onClose}>
      <div
        ref={menuRef}
        className="absolute z-[100] min-w-[12rem] max-w-60 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-1 shadow-2xl backdrop-blur-xl animate-slide-up"
        style={{ left: position.x, top: position.y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => {
          if (item.id.startsWith("separator")) {
            return <div key={item.id} className="my-1 h-px bg-[var(--border-subtle)]" />;
          }
          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className="w-full justify-start rounded px-2 py-1.5 text-left text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
              onClick={() => {
                onRunCommand(item.id);
                onClose();
              }}
              disabled={item.disabled}
            >
              {item.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
