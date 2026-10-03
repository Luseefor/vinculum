"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useGraphStore } from "@/store/graphStore";
import { WORKSPACE_CONTENT } from "@/lib/workspace/workspaceContent";
import ObjectRow from "@/components/objects/ObjectRow";

interface ObjectTreeProps {
  filterQuery?: string;
  visibleOnly?: boolean;
  excludeId?: string | null;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export default function ObjectTree({ filterQuery = "", visibleOnly = false, excludeId = null }: ObjectTreeProps) {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectObject = useGraphStore((state) => state.selectObject);
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const workspace = useGraphStore((state) => state.ui.workspace);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) {
      return objects.filter((object) => object.id !== excludeId && (!visibleOnly || object.visible));
    }
    return objects.filter((object, index) => {
      if (object.id === excludeId) return false;
      if (visibleOnly && !object.visible) {
        return false;
      }
      const label = `${object.kind} #${index + 1}`.toLowerCase();
      return label.includes(q) || object.id.toLowerCase().includes(q);
    });
  }, [filterQuery, objects, visibleOnly, excludeId]);
  const objectIndexById = useMemo(() => {
    const map = new Map<string, number>();
    objects.forEach((object, index) => {
      map.set(object.id, index);
    });
    return map;
  }, [objects]);

  // S31 row-follow policy (Part 2): a canvas selection highlights the row
  // and scrolls it into view only when offscreen (block:nearest never
  // yanks an already-visible list). Selection never forces expansion —
  // expansion stays row-click-driven / create-driven in ObjectRow.
  useEffect(() => {
    if (!selectedObjectId) {
      return;
    }
    const container = listRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-object-row-select="${selectedObjectId}"]`);
    if (!container || !row || typeof row.scrollIntoView !== "function") {
      return;
    }
    const rowRect = row.getBoundingClientRect();
    const listRect = container.getBoundingClientRect();
    if (rowRect.top < listRect.top || rowRect.bottom > listRect.bottom) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [selectedObjectId]);

  if (objects.length === 0) {
    return (
      <div className="mx-1 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-3 text-center">
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">No objects in scene.</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{WORKSPACE_CONTENT[workspace].emptyHint}</p>
      </div>
    );
  }

  const focusRowAt = (rowIndex: number) => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-object-row-select]")];
    const target = buttons[rowIndex];
    if (!target) {
      return;
    }
    target.focus();
    const id = target.getAttribute("data-object-row-select");
    if (id) {
      selectObject(id);
    }
  };

  const handleListKeyDown = (event: ReactKeyboardEvent) => {
    if (isTextEditingTarget(event.target)) {
      return;
    }
    const container = listRef.current;
    if (!container) {
      return;
    }
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-object-row-select]")];
    if (buttons.length === 0) {
      return;
    }
    const activeIndex = buttons.findIndex((button) => button === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRowAt(activeIndex === -1 ? 0 : Math.min(activeIndex + 1, buttons.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRowAt(activeIndex === -1 ? buttons.length - 1 : Math.max(activeIndex - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRowAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRowAt(buttons.length - 1);
    }
  };

  return (
    <div ref={listRef} onKeyDown={handleListKeyDown} className="space-y-1.5">
      <div className="space-y-0.5">
        {filtered.map((object) => {
          const index = objectIndexById.get(object.id) ?? -1;
          return (
            <ObjectRow
              key={object.id}
              object={object}
              index={index}
              selected={object.id === selectedObjectId}
              onSelect={selectObject}
              onToggleVisibility={toggleObjectVisibility}
            />
          );
        })}
        {filtered.length === 0 && !excludeId ? (
          <div className="mx-1 rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2 text-center">
            <p className="text-[11px] text-[var(--text-tertiary)]">No matching objects.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
