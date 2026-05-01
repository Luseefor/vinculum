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
  const normalizedScene: SceneDocument = {
    ...scene,
    measurements: Array.isArray(scene.measurements) ? scene.measurements : []
  };
  const mergedUi = ui ?? current.ui;
  return {
    ...current,
    scene: normalizedScene,
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
      selectedObjectId: resolveSelectedObjectId(mergedUi.selectedObjectId ?? null, normalizedScene.objects),
      selectedMeasurementId:
        typeof mergedUi.selectedMeasurementId === "string" &&
        normalizedScene.measurements.some((measurement) => measurement.id === mergedUi.selectedMeasurementId)
          ? mergedUi.selectedMeasurementId
          : null,
      measurementDraft: null,
      probePins: normalizedScene.measurements
        .filter((measurement) => measurement.kind === "pin")
        .map((measurement, index) => ({
          id: measurement.id,
          color: PROBE_PIN_COLORS[index % PROBE_PIN_COLORS.length] ?? "#f472b6",
          world: measurement.point
        })),
      projectSession: {
        currentProjectId: mergedUi.projectSession?.currentProjectId ?? null,
        currentProjectName: mergedUi.projectSession?.currentProjectName ?? null,
        autosaveStatus: mergedUi.projectSession?.autosaveStatus ?? "idle",
        autosaveError: mergedUi.projectSession?.autosaveError ?? null
      },
      sceneDialog: {
        ...mergedUi.sceneDialog,
        isOpen: false,
        error: null
      }
    }
  };
}

const PROBE_PIN_COLORS = [
  "#f472b6",
  "#22c55e",
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#34d399",
  "#60a5fa"
] as const;
