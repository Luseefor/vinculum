import { useGraphStore } from "@/store/graphStore";
import { isTypingTarget } from "./graphThreeEngineDom";
import { isDragTransactionActive } from "@/lib/interaction/dragHistoryTransaction";
import type { GraphThreeEngineInputHandlersDeps } from "./graphThreeEngineInputTypes";

export function createGraphThreeKeyboardAndContextHandlers(
  deps: Pick<
    GraphThreeEngineInputHandlersDeps,
    "tickRuntime" | "renderer" | "ndc" | "raycaster" | "camera" | "probeMarkerMeshes" | "resolvePickContext"
  > & { clearSketch: () => void }
) {
  const { tickRuntime, renderer, ndc, raycaster, camera, probeMarkerMeshes, clearSketch } = deps;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.key === "Alt") {
      tickRuntime.isAltDown = true;
    } else if (event.key === "1" || event.key === "2" || event.key === "3") {
      // S33-R10: tool hotkeys are ignored mid-drag (the next-frame tick
      // cancels the drag with restore; switching first could land one
      // stray write before the cancel).
      if (isDragTransactionActive()) {
        return;
      }
      if (event.key === "1") {
        useGraphStore.getState().setCanvas3dTool("pan");
      } else if (event.key === "2") {
        useGraphStore.getState().setCanvas3dTool("probe");
      } else {
        useGraphStore.getState().setCanvas3dTool("draw");
      }
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
    if (tool !== "probe" && tool !== "addPin" && tool !== "measureDistance" && tool !== "measureAngle") {
      return;
    }
    const mouseEvent = event as MouseEvent;
    const pickOverride = deps.resolvePickContext?.(mouseEvent.clientX, mouseEvent.clientY) ?? null;
    const rect = pickOverride?.rect ?? renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    ndc.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, pickOverride?.camera ?? camera);
    const hits = raycaster.intersectObjects(probeMarkerMeshes, false);
    const hit = hits[0];
    const id = hit?.object?.userData?.probePinId as string | undefined;
    if (id) {
      useGraphStore.getState().removeProbePin(id);
    }
  };

  return { handleKeyDown, handleKeyUp, handleContextMenu };
}
