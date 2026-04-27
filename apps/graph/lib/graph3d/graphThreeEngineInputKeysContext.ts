import { useGraphStore } from "@/store/graphStore";
import { isTypingTarget } from "./graphThreeEngineDom";
import type { GraphThreeEngineInputHandlersDeps } from "./graphThreeEngineInputTypes";

export function createGraphThreeKeyboardAndContextHandlers(
  deps: Pick<
    GraphThreeEngineInputHandlersDeps,
    "tickRuntime" | "renderer" | "ndc" | "raycaster" | "camera" | "probeMarkerMeshes"
  > & { clearSketch: () => void }
) {
  const { tickRuntime, renderer, ndc, raycaster, camera, probeMarkerMeshes, clearSketch } = deps;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.key === "Alt") {
      tickRuntime.isAltDown = true;
    } else if (event.key === "1") {
      useGraphStore.getState().setCanvas3dTool("pan");
    } else if (event.key === "2") {
      useGraphStore.getState().setCanvas3dTool("probe");
    } else if (event.key === "3") {
      useGraphStore.getState().setCanvas3dTool("draw");
    } else if (event.key === "Escape") {
      useGraphStore.getState().clearProbes();
      clearSketch();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      tickRuntime.isAltDown = false;
    }
  };

  const handleContextMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation?.();
    const tool = useGraphStore.getState().ui.canvas3dTool;
    if (tool !== "probe") {
      return;
    }
    const mouseEvent = event as MouseEvent;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    ndc.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(probeMarkerMeshes, false);
    const hit = hits[0];
    const id = hit?.object?.userData?.probePinId as string | undefined;
    if (id) {
      useGraphStore.getState().removeProbePin(id);
    }
  };

  return { handleKeyDown, handleKeyUp, handleContextMenu };
}
