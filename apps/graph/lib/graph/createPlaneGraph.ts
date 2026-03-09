import { createDefaultPlaneGraph } from "@vinculum/scene/defaults";
import type { PlaneAppearance, PlaneGraphObject } from "@vinculum/scene/types";

interface CreatePlaneGraphInput {
  colorIndex?: number;
  equation?: string;
  size?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<PlaneAppearance>;
  id?: string;
}

let planeGraphCounter = 0;

function createPlaneGraphId(): string {
  planeGraphCounter += 1;
  return `plane-${Date.now().toString(36)}-${planeGraphCounter.toString(36)}`;
}

export function createPlaneGraph(input: CreatePlaneGraphInput = {}): PlaneGraphObject {
  return createDefaultPlaneGraph({
    id: input.id ?? createPlaneGraphId(),
    index: input.colorIndex,
    equation: input.equation,
    size: input.size,
    visible: input.visible,
    color: input.color,
    appearance: input.appearance
  });
}
