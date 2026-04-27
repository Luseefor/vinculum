import { Mesh } from "three";
import type { Group, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { WebGLRenderer } from "three";

export type PickWorldFromCanvasArgs = {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  raycaster: Raycaster;
  ndc: Vector2;
  objectsRoot: Group;
  baselinePlane: Plane;
  tempGround: Vector3;
};

export function pickWorldPointFromCanvasPointer(
  event: { clientX: number; clientY: number },
  args: PickWorldFromCanvasArgs
): { x: number; y: number; z: number } | null {
  const { renderer, camera, raycaster, ndc, objectsRoot, baselinePlane, tempGround } = args;
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObjects(objectsRoot.children, true);
  for (const hit of hits) {
    if (hit.object instanceof Mesh) {
      return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
    }
  }

  if (raycaster.ray.intersectPlane(baselinePlane, tempGround)) {
    return { x: tempGround.x, y: tempGround.y, z: tempGround.z };
  }
  return null;
}
