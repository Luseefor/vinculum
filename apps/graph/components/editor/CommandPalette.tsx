"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

const COMMANDS = [
  { id: "add-surface", label: "Add Surface" },
  { id: "add-curve", label: "Add 3D Curve" },
  { id: "toggle-2d", label: "Switch to 2D" },
  { id: "toggle-3d", label: "Switch to 3D" },
  { id: "switch-split", label: "Switch to Split View" },
  { id: "reset-view", label: "Reset View" }
];

export default function CommandPalette({ open, onClose, onRunCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return COMMANDS;
    }
    return COMMANDS.filter((command) => command.label.toLowerCase().includes(q));
  }, [query]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-[var(--surface-backdrop)]/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-[10vh] w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-[var(--shadow-floating)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[var(--border-subtle)] p-3">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command…"
            className="h-9"
            aria-label="Command search"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={() => {
                onRunCommand(command.id);
                onClose();
              }}
              className="w-full rounded-md px-2 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
            >
              {command.label}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)]">No matching commands.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
