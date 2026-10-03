"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
}

export default function ContextMenu({ open, x, y, onClose, onRunCommand, hasSelection, canUndo, canRedo }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x, y });
  const items = [
    { id: "add-expression", label: "Add equation" },
    { id: "separator-view", label: "" },
    { id: "reset-view", label: "Reset view" },
    { id: "fit-scene", label: "Fit scene" },
    ...(hasSelection ? [{ id: "frame-selected", label: "Frame selected" }] : []),
    ...(canUndo || canRedo ? [{ id: "separator-history", label: "" }] : []),
    ...(canUndo ? [{ id: "undo", label: "Undo" }] : []),
    ...(canRedo ? [{ id: "redo", label: "Redo" }] : []),
    ...(hasSelection ? [{ id: "separator-selection", label: "" }, { id: "delete-selected", label: "Remove selected" }] : [])
  ];
  useLayoutEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const place = () => {
      const rect = menuRef.current?.getBoundingClientRect();
      const width = rect?.width ?? 224;
      const height = rect?.height ?? 240;
      setPosition({ x: Math.max(8, Math.min(x, window.innerWidth - width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - height - 8)) });
    };
    place();
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, x, y, hasSelection, canUndo, canRedo]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100]" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
      <div ref={menuRef} role="menu" aria-label="Scene context menu"
        className="absolute w-56 max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] p-1.5 shadow-lg animate-fade-in"
        style={{ left: position.x, top: position.y }} onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            if (event.key === "Escape") event.preventDefault();
            event.stopPropagation(); onClose(); previousFocus.current?.focus(); return;
          }
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
          if (direction || event.key === "Home" || event.key === "End") {
            event.preventDefault(); event.stopPropagation();
            buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + direction + buttons.length) % buttons.length]?.focus();
          }
        }}>
        {items.map((item) => item.id.startsWith("separator")
          ? <div key={item.id} role="separator" className="my-1.5 h-px bg-[var(--border-subtle)]" />
          : <Button key={item.id} type="button" role="menuitem" variant="ghost"
            className={`min-h-11 sm:min-h-9 w-full justify-start rounded-[var(--radius-md)] px-3 text-left text-[13px] ${item.id === "delete-selected" ? "text-[var(--status-error-fg)]" : "text-[var(--text-primary)]"}`}
            onClick={() => { onClose(); previousFocus.current?.focus(); onRunCommand(item.id); }}>{item.label}</Button>)}
      </div>
    </div>, document.body
  );
}
