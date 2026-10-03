import { createDefaultImplicitSurfaceGraph } from "@vinculum/scene/defaults";
import type { ImplicitSurfaceDomain, ImplicitSurfaceObject, SurfaceAppearance } from "@vinculum/scene/types";

interface CreateImplicitSurfaceGraphInput {
  colorIndex?: number;
  equation?: string;
  domain?: Partial<ImplicitSurfaceDomain>;
  resolution?: number;
  visible?: boolean;
  color?: string;
  appearance?: Partial<SurfaceAppearance>;
  id?: string;
}

let implicitSurfaceGraphCounter = 0;

function createImplicitSurfaceGraphId(): string {
  implicitSurfaceGraphCounter += 1;
  return `implicit-surface-${Date.now().toString(36)}-${implicitSurfaceGraphCounter.toString(36)}`;
}

export function createImplicitSurfaceGraph(input: CreateImplicitSurfaceGraphInput = {}): ImplicitSurfaceObject {
  return createDefaultImplicitSurfaceGraph({
    id: input.id ?? createImplicitSurfaceGraphId(),
    index: input.colorIndex,
    equation: input.equation,
    domain: input.domain,
    resolution: input.resolution,
    visible: input.visible,
    color: input.color,
    appearance: input.appearance
  });
}
