import { createAdaptiveGridState, hasAdaptiveGridStateChanged } from "@/lib/graph/adaptiveGridState";
import {
  computeAxisScaleAxes,
  computeAxisScaleLabels
} from "./graphThreeAxisGeometry";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";
import type { Group, Mesh, PerspectiveCamera, Vector2, Vector3 } from "three";

export type GraphThreeTickGridUniforms = {
  uMinorStep: { value: number };
  uMajorStep: { value: number };
  uFadeDistance: { value: number };
  uGridOffset: { value: Vector2 };
  uCameraPosition: { value: Vector3 };
};

export function syncGraphThreeTickGridFrame(
  camera: PerspectiveCamera,
  runtime: GraphThreeEngineTickRuntime,
  gridMesh: Mesh,
  gridUniforms: GraphThreeTickGridUniforms,
  axesGroup: Group,
  labelGroup: Group
): void {
  const nextGrid = createAdaptiveGridState(camera.position.x, camera.position.y, camera.position.z);
  if (hasAdaptiveGridStateChanged(runtime.gridState, nextGrid)) {
    runtime.gridState = nextGrid;
    gridUniforms.uMinorStep.value = nextGrid.minorStep;
    gridUniforms.uMajorStep.value = nextGrid.majorStep;
    gridUniforms.uFadeDistance.value = nextGrid.fadeDistance;
    if (runtime.baselinePlaneMode === 1) {
      gridUniforms.uGridOffset.value.set(camera.position.x, camera.position.y);
    } else if (runtime.baselinePlaneMode === 2) {
      gridUniforms.uGridOffset.value.set(camera.position.y, camera.position.z);
    } else {
      gridUniforms.uGridOffset.value.set(nextGrid.gridOffset[0], nextGrid.gridOffset[1]);
    }
  }

  if (runtime.baselinePlaneMode === 1) {
    gridMesh.position.set(camera.position.x, camera.position.y, -0.0035);
  } else if (runtime.baselinePlaneMode === 2) {
    gridMesh.position.set(-0.0035, camera.position.y, camera.position.z);
  } else {
    gridMesh.position.set(camera.position.x, -0.0035, camera.position.z);
  }
  const diameter = nextGrid.fadeDistance * 2;
  gridMesh.scale.set(diameter, diameter, 1);
  gridUniforms.uCameraPosition.value.copy(camera.position);

  const axisScaleAxes = computeAxisScaleAxes(camera.position.x, camera.position.y, camera.position.z);
  axesGroup.scale.setScalar(axisScaleAxes);

  const axisScaleLabels = computeAxisScaleLabels(camera.position.x, camera.position.y, camera.position.z);
  labelGroup.scale.setScalar(axisScaleLabels);
}
