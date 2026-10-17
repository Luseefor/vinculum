import { migrateSceneDocumentEnvelope, parseSceneParameters } from "@/lib/scene/validateScene";
import { completeSceneParameters, getSceneParameterNames } from "@/lib/scene/sceneParameters";
import { useEditorStore } from "@/lib/store/editorStore";
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
  if (!scene || !Array.isArray(scene.objects)) {
    return current;
  }
  // Session state can contain unfinished expression drafts. Migrate the
  // envelope and validate the portable scope without discarding those drafts.
  // External files/projects/share links still use full scene validation.
  const migrated = migrateSceneDocumentEnvelope({ ...scene });
  if (!migrated.ok) return current;
  const errors: string[] = [];
  let parameters = completeSceneParameters(scene.objects, parseSceneParameters(migrated.document.parameters, errors));
  if (errors.length) return current;
  if (scene.schemaVersion < 2 || scene.schemaVersion === undefined) {
    const names = new Set(getSceneParameterNames(scene.objects));
    const previous = useEditorStore.getState().parameters.filter(parameter => parameter.defined || names.has(parameter.id));
    const saved = new Map(parameters.map(parameter => [parameter.id, parameter]));
    for (const parameter of previous) saved.set(parameter.id, { ...parameter });
    parameters = [...saved.values()];
  }
  const normalizedScene: SceneDocument = {
    ...scene,
    schemaVersion: migrated.document.schemaVersion as number,
    measurements: Array.isArray(scene.measurements) ? scene.measurements : [],
    parameters
  };
  const mergedUi = ui ?? current.ui;
  return {
    ...current,
    scene: normalizedScene,
    ui: {
      ...current.ui,
      ...mergedUi,
      workspace: mergedUi.workspace === "geometry" || mergedUi.workspace === "math" ? mergedUi.workspace : "math",
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
      focusEquationForObjectId: null,
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
