import { createDefaultSurfaceGraph } from "@vinculum/scene/defaults";
import type { SurfaceAppearance, SurfaceDomain, SurfaceGraphObject } from "@vinculum/scene/types";

interface CreateSurfaceGraphInput {
  colorIndex?: number;
  equation?: string;
  visible?: boolean;
  color?: string;
  domain?: Partial<SurfaceDomain>;
  resolution?: number;
  appearance?: Partial<SurfaceAppearance>;
  id?: string;
}

let surfaceGraphCounter = 0;

function createSurfaceGraphId(): string {
  surfaceGraphCounter += 1;
  return `surface-${Date.now().toString(36)}-${surfaceGraphCounter.toString(36)}`;
}

export function createSurfaceGraph(input: CreateSurfaceGraphInput = {}): SurfaceGraphObject {
  return createDefaultSurfaceGraph({
    id: input.id ?? createSurfaceGraphId(),
    index: input.colorIndex,
    equation: input.equation,
    visible: input.visible,
    color: input.color,
    domain: input.domain,
    resolution: input.resolution,
    appearance: input.appearance
  });
}
