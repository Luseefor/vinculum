import type { GraphRenderer } from "./graphRenderer";
import { Mesh } from "three";
import type { Group, OrthographicCamera, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";

export type PickWorldFromCanvasArgs = {
  renderer: GraphRenderer;
  camera: PerspectiveCamera;
  raycaster: Raycaster;
  ndc: Vector2;
  objectsRoot: Group;
  baselinePlane: Plane;
  tempGround: Vector3;
  /**
   * Multi-view override: camera and client-coordinate rect scoping NDC to
   * one pane. Absent selects the legacy full-canvas perspective behavior.
   */
  pickOverride?: {
    camera: PerspectiveCamera | OrthographicCamera;
    rect: { left: number; top: number; width: number; height: number };
  } | null;
};

export function pickWorldPointFromCanvasPointer(
  event: { clientX: number; clientY: number },
  args: PickWorldFromCanvasArgs
): { x: number; y: number; z: number } | null {
  if (!setPickRaycaster(event, args)) {
    return null;
  }
  const { raycaster, objectsRoot, baselinePlane, tempGround } = args;

  const hits = raycaster.intersectObjects(objectsRoot.children, true);
  for (const hit of hits) {
    // S26: invisible primitive pick proxies never own probe hits — a line
    // crossing a surface must not make surface probing impossible. The
    // visible shaft/head/marker meshes keep standard Mesh behavior.
    if (hit.object instanceof Mesh && (hit.object.userData as { pickProxy?: unknown }).pickProxy !== true) {
      return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    }
  }

  if (raycaster.ray.intersectPlane(baselinePlane, tempGround)) {
    return { x: tempGround.x, y: tempGround.y, z: tempGround.z };
  }
  return null;
}

// Shared pointer→ray setup (S21: reused by the analysis pick path so both
// pickers share NDC scoping, multi-view overrides, and degenerate guards).
export function setPickRaycaster(
  event: { clientX: number; clientY: number },
  args: PickWorldFromCanvasArgs
): boolean {
  const { renderer, camera, raycaster, ndc } = args;
  const activeCamera = args.pickOverride?.camera ?? camera;
  const rect = args.pickOverride?.rect ?? renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, activeCamera);
  return true;
}
