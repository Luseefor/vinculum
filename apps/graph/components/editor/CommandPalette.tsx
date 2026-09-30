"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onRunCommand: (commandId: string) => void;
}

import { OBJECT_DESCRIPTORS, type PaletteCategory } from "@/lib/objects/objectDescriptors";

interface PaletteCommand {
  id: string;
  label: string;
  category: PaletteCategory;
  aliases: string[];
}

// S30: creation commands render from the central descriptors (labels and
// search aliases cannot drift from Quick Add / Add Object menu). Command ids
// are unchanged; only the "Add 3D Curve" label becomes the canonical
// "Add Parametric Curve".
const COMMANDS: PaletteCommand[] = [
  ...OBJECT_DESCRIPTORS.map((entry) => ({
    id: entry.commandId,
    label: entry.commandLabel,
    category: "Create" as PaletteCategory,
    aliases: entry.aliases
  })),
  { id: "delete-selected", label: "Delete Selected Object", category: "Object", aliases: ["delete", "remove"] },
  { id: "switch-workspace-geometry", label: "Switch to Geometry Studio", category: "Workspace", aliases: ["workspace", "geometry", "studio"] },
  { id: "switch-workspace-math", label: "Switch to Math Lab", category: "Workspace", aliases: ["workspace", "math", "lab"] },
  { id: "toggle-2d", label: "Switch to 2D", category: "View", aliases: ["view", "2d", "canvas"] },
  { id: "toggle-3d", label: "Switch to 3D", category: "View", aliases: ["view", "3d", "scene"] },
  { id: "switch-split", label: "Switch to Split View", category: "View", aliases: ["view", "split", "layout"] },
  { id: "switch-quad", label: "Switch to Quad View", category: "View", aliases: ["view", "quad", "layout"] },
  { id: "geometry-view-perspective", label: "Geometry View: Perspective", category: "View", aliases: ["geometry", "perspective", "camera"] },
  { id: "geometry-view-xy", label: "Geometry View: XY", category: "View", aliases: ["geometry", "xy", "top"] },
  { id: "geometry-view-xz", label: "Geometry View: XZ", category: "View", aliases: ["geometry", "xz", "front"] },
  { id: "geometry-view-yz", label: "Geometry View: YZ", category: "View", aliases: ["geometry", "yz", "side"] },
  { id: "geometry-layout-single", label: "Geometry Layout: Single", category: "View", aliases: ["geometry", "layout", "single"] },
  { id: "geometry-layout-split", label: "Geometry Layout: Split", category: "View", aliases: ["geometry", "layout", "split"] },
  { id: "geometry-layout-quad", label: "Geometry Layout: Quad", category: "View", aliases: ["geometry", "layout", "quad"] },
  { id: "toggle-snap", label: "Toggle Snap", category: "Scene", aliases: ["snap", "grid"] },
  { id: "reset-view", label: "Reset View", category: "Scene", aliases: ["reset", "camera", "view"] },
  { id: "frame-selected", label: "Frame Selected", category: "View", aliases: ["frame", "focus", "camera", "selection", "zoom"] },
  { id: "fit-scene", label: "Fit Scene", category: "View", aliases: ["fit", "frame", "camera", "overview", "zoom"] },
  { id: "undo", label: "Undo", category: "Scene", aliases: ["undo", "history"] },
  { id: "redo", label: "Redo", category: "Scene", aliases: ["redo", "history"] },
  { id: "export-scene-json", label: "Export Scene JSON", category: "Scene", aliases: ["export", "json", "save", "download"] },
  { id: "import-scene-json", label: "Import Scene JSON", category: "Scene", aliases: ["import", "json", "open", "load"] }
];

const CATEGORY_ORDER: PaletteCategory[] = ["Create", "View", "Workspace", "Object", "Scene"];

/** S30: alias-aware matching (unit-tested in s30ProductIA). */
export function matchPaletteCommand(command: PaletteCommand, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return command.label.toLowerCase().includes(q) || command.aliases.some((alias) => alias.includes(q));
}

export default function CommandPalette({ open, onClose, onRunCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return COMMANDS;
    }
    return COMMANDS.filter((command) => matchPaletteCommand(command, q));
  }, [query]);
  const showingCategories = query.trim().length === 0;
  const activeCommand = filtered[activeIndex];
  const activeOptionId = activeCommand ? `command-palette-option-${activeCommand.id}` : undefined;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
  }, [open]);

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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-xl self-start mt-[10vh] p-0 border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-[var(--shadow-floating)]" contentProps={{ onClick: (event) => event.stopPropagation() }}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
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
            aria-autocomplete="list"
            aria-controls="command-palette-listbox"
            aria-activedescendant={activeOptionId}
          />
        </div>
        <div
          ref={listRef}
          id="command-palette-listbox"
          className="max-h-[50vh] overflow-y-auto p-2"
          role="listbox"
          aria-label="Commands"
        >
          {showingCategories
            ? CATEGORY_ORDER.map((category) => {
                const group = filtered.filter((command) => command.category === category);
                if (group.length === 0) {
                  return null;
                }
                return (
                  <div key={category} role="presentation">
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {category}
                    </p>
                    {group.map((command) => (
                      <PaletteOption
                        key={command.id}
                        command={command}
                        active={filtered[activeIndex]?.id === command.id}
                        optionId={`command-palette-option-${command.id}`}
                        onHover={() => {
                          const nextIndex = filtered.findIndex((item) => item.id === command.id);
                          if (nextIndex >= 0) {
                            setActiveIndex(nextIndex);
                          }
                        }}
                        onRun={() => {
                          onRunCommand(command.id);
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                );
              })
            : filtered.map((command) => (
                <PaletteOption
                  key={command.id}
                  command={command}
                  active={filtered[activeIndex]?.id === command.id}
                  optionId={`command-palette-option-${command.id}`}
                  onHover={() => {
                    const nextIndex = filtered.findIndex((item) => item.id === command.id);
                    if (nextIndex >= 0) {
                      setActiveIndex(nextIndex);
                    }
                  }}
                  onRun={() => {
                    onRunCommand(command.id);
                    onClose();
                  }}
                />
              ))}
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)]">No matching commands.</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-subtle)] px-3 py-2 text-[10px] text-[var(--text-tertiary)]">
          <span>
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
          </span>
          <span className="ml-auto text-right">
            ⌘/Ctrl+K · Undo/Redo · F Frame · Esc
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaletteOption({
  command,
  active,
  optionId,
  onHover,
  onRun
}: {
  command: PaletteCommand;
  active: boolean;
  optionId: string;
  onHover: () => void;
  onRun: () => void;
}) {
  return (
    <Button variant="ghost"
      id={optionId}
      type="button"
      data-command-id={command.id}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onRun}
      className={[
        "w-full rounded-md px-2 py-2 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
        active ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : ""
      ].join(" ")}
    >
      {command.label}
    </Button>
  );
}
