import { clearThreeSketch } from "./graphThreeSketchStroke";
import type { GraphThreeEngineInputHandlersDeps, GraphThreeEngineInputMutableState } from "./graphThreeEngineInputTypes";
import { createGraphThreeKeyboardAndContextHandlers } from "./graphThreeEngineInputKeysContext";
import { createGraphThreePointerInputHandlers } from "./graphThreeEngineInputPointer";

export type { GraphThreeEngineInputHandlersDeps, GraphThreeEngineInputMutableState } from "./graphThreeEngineInputTypes";

export function createGraphThreeEngineInputHandlers(deps: GraphThreeEngineInputHandlersDeps) {
  const clearSketch = () => {
    deps.mutable.sketchPoints = clearThreeSketch(deps.sketchGeometry, deps.sketchLine);
  };

  const pointer = createGraphThreePointerInputHandlers(deps);
  const keys = createGraphThreeKeyboardAndContextHandlers({
    tickRuntime: deps.tickRuntime,
    renderer: deps.renderer,
    ndc: deps.ndc,
    raycaster: deps.raycaster,
    camera: deps.camera,
    probeMarkerMeshes: deps.probeMarkerMeshes,
    clearSketch
  });

  return {
    ...pointer,
    ...keys
  };
}
