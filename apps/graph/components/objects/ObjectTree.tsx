"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useGraphStore } from "@/store/graphStore";
import ObjectRow from "@/components/objects/ObjectRow";

export default function ObjectTree() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectObject = useGraphStore((state) => state.selectObject);
  const toggleObjectVisibility = useGraphStore((state) => state.toggleObjectVisibility);
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      return objects;
    }
    return objects.filter((object, index) => {
      const label = `${object.kind} #${index + 1}`.toLowerCase();
      return label.includes(q) || object.id.toLowerCase().includes(q);
    });
  }, [filter, objects]);

  if (objects.length === 0) {
    return <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)]">No objects in scene.</p>;
  }

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Search objects…"
        className="h-8 text-[11px]"
        aria-label="Filter objects"
      />
      <div className="space-y-1">
        {filtered.map((object) => {
          const index = objects.findIndex((candidate) => candidate.id === object.id);
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
