import type { GraphObject } from "@vinculum/scene/types";

export function findObjectById(objects: GraphObject[], id: string): GraphObject | null {
  return objects.find((object) => object.id === id) ?? null;
}

export function resolveSelectedObjectId(selectedObjectId: string | null, objects: GraphObject[]): string | null {
  if (selectedObjectId && objects.some((object) => object.id === selectedObjectId)) {
    return selectedObjectId;
  }

  return objects[0]?.id ?? null;
}
