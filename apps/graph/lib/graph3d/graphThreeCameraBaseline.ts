import type { PerspectiveCamera } from "three";
import { Vector3 } from "three";

export function alignCameraToThreeBaseline(
  pair: "xy" | "xz" | "yz",
  target: Vector3,
  distance: number,
  camera: PerspectiveCamera,
  fallbackDistance: number
): void {
  const safeDistance = Number.isFinite(distance) && distance > 0.001 ? distance : fallbackDistance;
  let up = new Vector3(0, 1, 0);
  let direction = new Vector3(1, 1, 1);

  if (pair === "xz") {
    up = new Vector3(0, 0, 1);
    direction = new Vector3(1, -1, 1);
  } else if (pair === "yz") {
    up = new Vector3(1, 0, 0);
    direction = new Vector3(1, 1, 1);
  }

  camera.up.copy(up.normalize());
  const nextPosition = target.clone().add(direction.normalize().multiplyScalar(safeDistance));
  camera.position.copy(nextPosition);
  camera.lookAt(target);
}
