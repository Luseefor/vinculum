"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  { id: "switch-quad", label: "Switch to Quad View" },
  { id: "reset-view", label: "Reset View" },
  { id: "undo", label: "Undo" },
  { id: "redo", label: "Redo" },
  { id: "export-scene-json", label: "Export Scene JSON" },
  { id: "import-scene-json", label: "Import Scene JSON" }
];

export default function CommandPalette({ open, onClose, onRunCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return COMMANDS;
    }
    return COMMANDS.filter((command) => command.label.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const command = filtered[activeIndex];
    if (!command || !listRef.current) {
      return;
    }
    const target = listRef.current.querySelector<HTMLButtonElement>(`[data-command-id="${command.id}"]`);
    target?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, open]);

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
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => {
                  if (filtered.length === 0) {
                    return 0;
                  }
                  return (index + 1) % filtered.length;
                });
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => {
                  if (filtered.length === 0) {
                    return 0;
                  }
                  return (index - 1 + filtered.length) % filtered.length;
                });
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const command = filtered[activeIndex];
                if (!command) {
                  return;
                }
                onRunCommand(command.id);
                onClose();
                setQuery("");
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setQuery("");
                onClose();
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setActiveIndex(0);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setActiveIndex(Math.max(0, filtered.length - 1));
              }
            }}
            placeholder="Type a command…"
            className="h-9"
            aria-label="Command search"
          />
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox" aria-label="Commands">
          {filtered.map((command) => (
            <button
              key={command.id}
              type="button"
              data-command-id={command.id}
              role="option"
              aria-selected={filtered[activeIndex]?.id === command.id}
              onMouseEnter={() => {
                const nextIndex = filtered.findIndex((item) => item.id === command.id);
                if (nextIndex >= 0) {
                  setActiveIndex(nextIndex);
                }
              }}
              onFocus={() => {
                const nextIndex = filtered.findIndex((item) => item.id === command.id);
                if (nextIndex >= 0) {
                  setActiveIndex(nextIndex);
                }
              }}
              onClick={() => {
                onRunCommand(command.id);
                onClose();
              }}
              className={[
                "w-full rounded-md px-2 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
                filtered[activeIndex]?.id === command.id ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : ""
              ].join(" ")}
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
