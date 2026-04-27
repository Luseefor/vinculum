import type { SceneDocument } from "@/lib/scene/sceneSchema";
import type { GraphUiState } from "@/types/graphUi";
import { createDefaultViewport2D } from "./graphStoreViewportInit";
import type { GraphStoreState } from "./graphStoreTypes";
import { resolveSelectedObjectId } from "./graphStoreSelection";

export function mergePersistedGraphStore(
  persisted: unknown,
  current: GraphStoreState
): GraphStoreState {
  if (!persisted || typeof persisted !== "object" || !("scene" in persisted)) {
    return current;
  }
  const { scene, ui } = persisted as { scene: SceneDocument; ui?: GraphUiState };
  if (!scene?.objects) {
    return current;
  }
  const mergedUi = ui ?? current.ui;
  return {
    ...current,
    scene,
    ui: {
      ...current.ui,
      ...mergedUi,
      viewport2dQuadTop: mergedUi.viewport2dQuadTop ?? createDefaultViewport2D(),
      viewport2dQuadTopFrame: mergedUi.viewport2dQuadTopFrame ?? { width: 0, height: 0 },
      axis2dPairQuadTop: mergedUi.axis2dPairQuadTop ?? "xz",
      active2dViewport:
        mergedUi.active2dViewport === "quadTop" || mergedUi.active2dViewport === "primary"
          ? mergedUi.active2dViewport
          : "primary",
      selectedObjectId: resolveSelectedObjectId(mergedUi.selectedObjectId ?? null, scene.objects),
      sceneDialog: {
        ...mergedUi.sceneDialog,
        isOpen: false,
        error: null
      }
    }
  };
}
