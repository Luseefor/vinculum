"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/store/graphStore";
import ObjectRow from "@/components/objects/ObjectRow";

interface ObjectTreeProps {
  filterQuery?: string;
  visibleOnly?: boolean;
}

export default function ObjectTree({ filterQuery = "", visibleOnly = false }: ObjectTreeProps) {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectObject = useGraphStore((state) => state.selectObject);
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) {
      return objects;
    }
    return objects.filter((object, index) => {
      if (visibleOnly && !object.visible) {
        return false;
      }
      const label = `${object.kind} #${index + 1}`.toLowerCase();
      return label.includes(q) || object.id.toLowerCase().includes(q);
    });
  }, [filterQuery, objects, visibleOnly]);
  const objectIndexById = useMemo(() => {
    const map = new Map<string, number>();
    objects.forEach((object, index) => {
      map.set(object.id, index);
    });
    return map;
  }, [objects]);

  if (objects.length === 0) {
    return (
      <div className="mx-1 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-3 text-center">
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">No objects in scene.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
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
      </div>
    </div>
  );
}
