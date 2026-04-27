import { useGraphStore } from "@/store/graphStore";
import type { EditorConstraint } from "@/lib/store/editorStore";
import { shiftHexColor } from "./shiftHexColor";

export function applyConstraintDerivedUpdates(
  constraints: EditorConstraint[],
  setObjectVisibility: (id: string, visible: boolean) => void,
  updateObjectColor: (id: string, color: string) => void
): number {
  const currentObjects = useGraphStore.getState().scene.objects;
  const objectsById = new Map(currentObjects.map((object) => [object.id, object] as const));
  const desiredVisibility = new Map<string, boolean>();
  const desiredColor = new Map<string, { color: string; priority: number }>();

  for (const constraint of constraints) {
    if (!constraint.enabled) {
      continue;
    }
    const sourceId = constraint.objectIds[0];
    const targetId = constraint.objectIds[1];
    if (!sourceId || !targetId || sourceId === targetId) {
      continue;
    }
    const source = objectsById.get(sourceId);
    const target = objectsById.get(targetId);
    if (!source || !target) {
      continue;
    }

    if (constraint.type === "attach") {
      desiredVisibility.set(target.id, source.visible);
      continue;
    }

    if (constraint.type === "align") {
      const current = desiredColor.get(target.id);
      if (!current || current.priority < 1) {
        desiredColor.set(target.id, { color: source.color, priority: 1 });
      }
      continue;
    }

    if (constraint.type === "offset") {
      const shifted = shiftHexColor(source.color);
      const current = desiredColor.get(target.id);
      if (!current || current.priority < 2) {
        desiredColor.set(target.id, { color: shifted, priority: 2 });
      }
    }
  }

  for (const [targetId, visible] of desiredVisibility) {
    setObjectVisibility(targetId, visible);
  }
  for (const [targetId, nextColor] of desiredColor) {
    updateObjectColor(targetId, nextColor.color);
  }

  return desiredVisibility.size + desiredColor.size;
}
