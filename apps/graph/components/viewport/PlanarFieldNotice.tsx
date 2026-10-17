"use client";

import { revealObjectInViewport } from "@/lib/objects/objectCreation";
import { useGraphStore } from "@/store/graphStore";

/** Explains fields excluded by the shared 3D renderer, including Geometry Studio. */
export default function PlanarFieldNotice({ showAction = true }: { showAction?: boolean }) {
  const count = useGraphStore(state => state.scene.objects.filter(object => object.visible && object.kind === "vectorField" && object.dimension === "2d").length);
  if (!count) return null;
  return (
    <div className="absolute bottom-3 left-3 z-25 max-w-[calc(100%-2rem)] rounded-sm bg-(--surface-overlay) px-2 py-1 text-[11px] text-(--text-secondary)">
      <p data-testid="graph3d-planar-only-note">{count} {count === 1 ? "vector field is" : "vector fields are"} shown in 2D only</p>
      {showAction ? <button type="button" className="mt-1 rounded-sm px-2 py-1 text-(--accent-ink) hover:bg-(--accent-soft) focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--accent)" onClick={() => {
        const field = useGraphStore.getState().scene.objects.find(object => object.visible && object.kind === "vectorField" && object.dimension === "2d");
        if (field) revealObjectInViewport(field.id);
      }}>Show in 2D</button> : null}
    </div>
  );
}
