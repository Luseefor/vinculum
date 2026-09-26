import { createDefaultLinearTransformGraph } from "@vinculum/scene/defaults";
import type {
  LinearTransformDimension,
  LinearTransformObject,
  LinearTransformObject2D,
  LinearTransformObject3D
} from "@vinculum/scene/types";

interface CreateLinearTransformGraphInput {
  colorIndex?: number;
  dimension?: LinearTransformDimension;
  entries?: Partial<Record<string, string>>;
  visible?: boolean;
  color?: string;
  id?: string;
}

let linearTransformGraphCounter = 0;

function createLinearTransformGraphId(): string {
  linearTransformGraphCounter += 1;
  return `linear-transform-${Date.now().toString(36)}-${linearTransformGraphCounter.toString(36)}`;
}

export function createLinearTransformGraph(
  input: CreateLinearTransformGraphInput & { dimension: "2d" }
): LinearTransformObject2D;
export function createLinearTransformGraph(
  input: CreateLinearTransformGraphInput & { dimension: "3d" }
): LinearTransformObject3D;
export function createLinearTransformGraph(input: CreateLinearTransformGraphInput): LinearTransformObject;
export function createLinearTransformGraph(input: CreateLinearTransformGraphInput = {}): LinearTransformObject {
  const dimension = input.dimension ?? "2d";
  if (dimension === "2d") {
    return createDefaultLinearTransformGraph({
      id: input.id ?? createLinearTransformGraphId(),
      index: input.colorIndex,
      dimension: "2d",
      entries: input.entries,
      visible: input.visible,
      color: input.color
    });
  }
  return createDefaultLinearTransformGraph({
    id: input.id ?? createLinearTransformGraphId(),
    index: input.colorIndex,
    dimension: "3d",
    entries: input.entries,
    visible: input.visible,
    color: input.color
  });
}
