"use client";

import { useGraphStore } from "@/store/graphStore";
import ObjectRow from "@/components/objects/ObjectRow";

export default function ObjectTree() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectObject = useGraphStore((state) => state.selectObject);

  if (objects.length === 0) {
    return <p className="px-2 py-2 text-[11px] text-[var(--text-tertiary)]">No objects in scene.</p>;
  }

  return (
    <div className="space-y-1">
      {objects.map((object) => (
        <ObjectRow key={object.id} object={object} selected={object.id === selectedObjectId} onSelect={selectObject} />
      ))}
    </div>
  );
}
