import { MOUSE } from "three";
import type { OrbitControls } from "three-stdlib";

export function syncOrbitControlsToCanvas3dTool(
  controls: OrbitControls,
  canvas3dTool: "pan" | "probe" | "draw",
  isAltDown: boolean
): void {
  if (canvas3dTool === "pan" || isAltDown) {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons.LEFT = MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = MOUSE.PAN;
  } else if (canvas3dTool === "probe") {
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.mouseButtons.LEFT = MOUSE.PAN;
    controls.mouseButtons.RIGHT = MOUSE.PAN;
  } else {
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.mouseButtons.LEFT = MOUSE.PAN;
    controls.mouseButtons.RIGHT = MOUSE.PAN;
  }
}
