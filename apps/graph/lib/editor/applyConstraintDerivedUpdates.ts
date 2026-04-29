import { useGraphStore } from "@/store/graphStore";
import type { EditorConstraint } from "@/lib/store/editorStore";
import { shiftHexColor } from "./shiftHexColor";

export function applyConstraintDerivedUpdates(
  constraints: EditorConstraint[],
  setObjectVisibility: (id: string, visible: boolean) => void,
  updateObjectColor: (id: string, color: string) => void
): { updateCount: number; errors: string[] } {
  const currentObjects = useGraphStore.getState().scene.objects;
  const objectsById = new Map(currentObjects.map((object) => [object.id, object] as const));
  const desiredVisibility = new Map<string, boolean>();
  const desiredColor = new Map<string, { color: string; priority: number }>();
  const errors: string[] = [];

  for (const constraint of constraints) {
    if (!constraint.enabled) {
      continue;
    }
    const sourceId = constraint.objectIds[0];
    const targetId = constraint.objectIds[1];
    if (!sourceId || !targetId || sourceId === targetId) {
      errors.push(`constraint ${constraint.id} invalid references`);
      continue;
    }
    const source = objectsById.get(sourceId);
    const target = objectsById.get(targetId);
    if (!source || !target) {
      errors.push(`constraint ${constraint.id} missing references`);
      continue;
    }
    if (!isAxisLocksValid(constraint.axisLocks)) {
      errors.push(`constraint ${constraint.id} invalid axis lock`);
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
      if (!Number.isFinite(constraint.offsetValue)) {
        errors.push(`constraint ${constraint.id} invalid offset`);
        continue;
      }
      const shifted = shiftHexColor(source.color, {
        axisLocks: constraint.axisLocks,
        offset: constraint.offsetValue
      });
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

  return { updateCount: desiredVisibility.size + desiredColor.size, errors };
}

function isAxisLocksValid(value: EditorConstraint["axisLocks"]): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.x === "boolean" &&
    typeof value.y === "boolean" &&
    typeof value.z === "boolean"
  );
}
