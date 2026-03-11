import { create } from "zustand";
import type {
  GraphObject,
  GraphObjectKind,
  ParametricCurveObject,
  PlaneGraphObject,
  SurfaceDomain,
  SurfaceGraphObject
} from "@vinculum/scene/types";
import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { serializeScene } from "@/lib/scene/serializeScene";
import {
  createSceneDocument,
  DEFAULT_SCENE_NAME,
  type SceneDocument
} from "@/lib/scene/sceneSchema";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import type { GraphUiState, SceneDialogMode, Surface2DRenderMode, ViewportMode } from "@/types/graphUi";

type ParametricExpressionField = keyof Pick<
  ParametricCurveObject,
  "xExpr" | "yExpr" | "zExpr" | "tMin" | "tMax" | "samples"
>;

interface GraphStoreState {
  scene: SceneDocument;
  ui: GraphUiState;
  cameraResetVersion: number;
  addSurfaceObject: () => string;
  addParametricCurve: () => string;
  addPlaneObject: () => string;
  insertObjectAfter: (id: string, kind: GraphObjectKind) => string;
  setObjectKind: (id: string, kind: GraphObjectKind) => void;
  updateSurfaceEquation: (id: string, equation: string) => void;
  updateParametricExpression: (id: string, field: ParametricExpressionField, value: string | number) => void;
  updatePlaneEquation: (id: string, equation: string) => void;
  toggleObjectVisibility: (id: string) => void;
  selectObject: (id: string) => void;
  removeObject: (id: string) => void;
  updateObjectColor: (id: string, color: string) => void;
  updateSurfaceDomain: (id: string, partialDomain: Partial<SurfaceDomain>) => void;
  updateSurfaceResolution: (id: string, resolution: number) => void;
  toggleSurfaceWireframe: (id: string) => void;
  replaceSceneDocument: (sceneDocument: SceneDocument) => void;
  resetScene: () => void;
  openSceneDialog: (mode: SceneDialogMode) => void;
  closeSceneDialog: () => void;
  setSceneDialogDraft: (jsonText: string) => void;
  setSceneDialogError: (error: string | null) => void;
  setViewportMode: (mode: ViewportMode) => void;
  setSurface2DRenderMode: (mode: Surface2DRenderMode) => void;
  requestCameraReset: () => void;
}

const initialScene = createInitialSceneDocument();

export const useGraphStore = create<GraphStoreState>((set) => ({
  scene: initialScene,
  ui: createInitialUiState(initialScene.objects[0]?.id ?? null),
  cameraResetVersion: 0,

  addSurfaceObject: () => {
    return appendObject(set, (index) => createSurfaceGraph({ colorIndex: index }));
  },

  addParametricCurve: () => {
    return appendObject(set, (index) => createParametricCurve({ colorIndex: index }));
  },

  addPlaneObject: () => {
    return appendObject(set, (index) => createPlaneGraph({ colorIndex: index }));
  },

  insertObjectAfter: (id, kind) => {
    let createdObjectId = "";

    set((state) => {
      const nextObject = createGraphObject(kind, state.scene.objects.length);
      createdObjectId = nextObject.id;

      const insertIndex = state.scene.objects.findIndex((object) => object.id === id);
      const command: SceneCommand = {
        type: "ADD_OBJECT",
        payload: {
          object: nextObject,
          index: insertIndex === -1 ? state.scene.objects.length : insertIndex + 1
        }
      };

      const nextScene = applySceneCommand(state.scene, command);

      return {
        scene: nextScene,
        ui: {
          ...state.ui,
          selectedObjectId: nextObject.id
        }
      };
    });

    return createdObjectId;
  },

  setObjectKind: (id, kind) => {
    set((state) => {
      const index = state.scene.objects.findIndex((object) => object.id === id);
      if (index === -1) {
        return state;
      }

      const currentObject = state.scene.objects[index];
      if (currentObject.kind === kind) {
        return state;
      }

      const replacement = createGraphObject(kind, index, {
        id: currentObject.id,
        color: currentObject.color,
        visible: currentObject.visible
      });

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: replacement
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  updateSurfaceEquation: (id, equation) => {
    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object || object.kind !== "surface") {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: {
            ...object,
            equation
          }
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  updateParametricExpression: (id, field, value) => {
    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object || object.kind !== "parametricCurve") {
        return state;
      }

      const nextObject = updateParametricCurveField(object, field, value);
      if (!nextObject) {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: nextObject
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  updatePlaneEquation: (id, equation) => {
    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object || object.kind !== "plane") {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: {
            ...object,
            equation
          }
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  toggleObjectVisibility: (id) => {
    set((state) => ({
      scene: applySceneCommand(state.scene, {
        type: "TOGGLE_VISIBILITY",
        payload: {
          id
        }
      })
    }));
  },

  selectObject: (id) => {
    set((state) => {
      const exists = state.scene.objects.some((object) => object.id === id);
      if (!exists) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          selectedObjectId: id
        }
      };
    });
  },

  removeObject: (id) => {
    set((state) => {
      const removeIndex = state.scene.objects.findIndex((object) => object.id === id);
      if (removeIndex === -1) {
        return state;
      }

      const fallbackObject =
        state.scene.objects[removeIndex + 1] ?? state.scene.objects[removeIndex - 1] ?? null;

      const nextScene = applySceneCommand(state.scene, {
        type: "REMOVE_OBJECT",
        payload: {
          id
        }
      });

      const nextSelectedObjectId =
        state.ui.selectedObjectId === id
          ? fallbackObject?.id ?? null
          : resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects);

      return {
        scene: nextScene,
        ui: {
          ...state.ui,
          selectedObjectId: nextSelectedObjectId
        }
      };
    });
  },

  updateObjectColor: (id, color) => {
    const safeColor = normalizeHexColor(color);
    if (!safeColor) {
      return;
    }

    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object) {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: {
            ...object,
            color: safeColor
          }
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  updateSurfaceDomain: (id, partialDomain) => {
    const sanitizedDomain = sanitizePartialDomain(partialDomain);

    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object || object.kind !== "surface") {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: {
            ...object,
            domain: {
              ...object.domain,
              ...sanitizedDomain
            }
          }
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  updateSurfaceResolution: (id, resolution) => {
    if (!Number.isFinite(resolution)) {
      return;
    }

    const safeResolution = Math.max(2, Math.floor(resolution));

    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object || object.kind !== "surface") {
        return state;
      }

      const command: SceneCommand = {
        type: "UPDATE_OBJECT",
        payload: {
          object: {
            ...object,
            resolution: safeResolution
          }
        }
      };

      return {
        scene: applySceneCommand(state.scene, command)
      };
    });
  },

  toggleSurfaceWireframe: (id) => {
    set((state) => {
      const object = findObjectById(state.scene.objects, id);
      if (!object) {
        return state;
      }

      if (object.kind === "surface") {
        return {
          scene: applySceneCommand(state.scene, {
            type: "UPDATE_OBJECT",
            payload: {
              object: {
                ...object,
                appearance: {
                  ...object.appearance,
                  wireframe: !object.appearance.wireframe
                }
              }
            }
          })
        };
      }

      if (object.kind === "plane") {
        return {
          scene: applySceneCommand(state.scene, {
            type: "UPDATE_OBJECT",
            payload: {
              object: {
                ...object,
                appearance: {
                  ...object.appearance,
                  wireframe: !object.appearance.wireframe
                }
              }
            }
          })
        };
      }

      return state;
    });
  },

  replaceSceneDocument: (sceneDocument) => {
    set((state) => {
      const nextScene = applySceneCommand(state.scene, {
        type: "REPLACE_SCENE",
        payload: {
          scene: sceneDocument
        }
      });

      return {
        scene: nextScene,
        ui: {
          ...state.ui,
          selectedObjectId: resolveSelectedObjectId(state.ui.selectedObjectId, nextScene.objects),
          sceneDialog: {
            ...state.ui.sceneDialog,
            isOpen: false,
            error: null
          }
        }
      };
    });
  },

  resetScene: () => {
    const defaultScene = createInitialSceneDocument();

    set((state) => ({
      scene: applySceneCommand(state.scene, {
        type: "REPLACE_SCENE",
        payload: {
          scene: defaultScene
        }
      }),
      ui: {
        ...state.ui,
        selectedObjectId: defaultScene.objects[0]?.id ?? null,
        sceneDialog: {
          ...state.ui.sceneDialog,
          isOpen: false,
          error: null,
          jsonText: ""
        }
      },
      cameraResetVersion: state.cameraResetVersion + 1
    }));
  },

  openSceneDialog: (mode) => {
    set((state) => ({
      ui: {
        ...state.ui,
        sceneDialog: {
          isOpen: true,
          mode,
          jsonText:
            mode === "export" ? serializeScene(state.scene) : state.ui.sceneDialog.mode === "import" ? state.ui.sceneDialog.jsonText : "",
          error: null
        }
      }
    }));
  },

  closeSceneDialog: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        sceneDialog: {
          ...state.ui.sceneDialog,
          isOpen: false,
          error: null
        }
      }
    }));
  },

  setSceneDialogDraft: (jsonText) => {
    set((state) => ({
      ui: {
        ...state.ui,
        sceneDialog: {
          ...state.ui.sceneDialog,
          jsonText
        }
      }
    }));
  },

  setSceneDialogError: (error) => {
    set((state) => ({
      ui: {
        ...state.ui,
        sceneDialog: {
          ...state.ui.sceneDialog,
          error
        }
      }
    }));
  },

  setViewportMode: (mode) => {
    set((state) => {
      if (state.ui.viewportMode === mode) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          viewportMode: mode
        },
        cameraResetVersion: state.cameraResetVersion + 1
      };
    });
  },

  setSurface2DRenderMode: (mode) => {
    set((state) => {
      if (state.ui.surface2DRenderMode === mode) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          surface2DRenderMode: mode
        }
      };
    });
  },

  requestCameraReset: () => {
    set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 }));
  }
}));

function appendObject(
  set: (partial: ((state: GraphStoreState) => GraphStoreState | Partial<GraphStoreState>) | Partial<GraphStoreState>) => void,
  createObject: (colorIndex: number) => GraphObject
): string {
  let createdObjectId = "";

  set((state) => {
    const nextObject = createObject(state.scene.objects.length);
    createdObjectId = nextObject.id;

    const nextScene = applySceneCommand(state.scene, {
      type: "ADD_OBJECT",
      payload: {
        object: nextObject
      }
    });

    return {
      scene: nextScene,
      ui: {
        ...state.ui,
        selectedObjectId: nextObject.id
      }
    };
  });

  return createdObjectId;
}

function createGraphObject(
  kind: GraphObjectKind,
  colorIndex: number,
  options: {
    id?: string;
    color?: string;
    visible?: boolean;
  } = {}
): GraphObject {
  if (kind === "parametricCurve") {
    return createParametricCurve({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  if (kind === "plane") {
    return createPlaneGraph({
      colorIndex,
      id: options.id,
      color: options.color,
      visible: options.visible
    });
  }

  return createSurfaceGraph({
    colorIndex,
    id: options.id,
    color: options.color,
    visible: options.visible
  });
}

function createInitialSceneDocument(): SceneDocument {
  const initialSurface = createSurfaceGraph({ colorIndex: 0 });

  return createSceneDocument({
    metadata: {
      name: DEFAULT_SCENE_NAME
    },
    objects: [initialSurface]
  });
}

function createInitialUiState(selectedObjectId: string | null): GraphUiState {
  return {
    selectedObjectId,
    viewportMode: "2d",
    surface2DRenderMode: "fill",
    sceneDialog: {
      isOpen: false,
      mode: "export",
      jsonText: "",
      error: null
    }
  };
}

function resolveSelectedObjectId(selectedObjectId: string | null, objects: GraphObject[]): string | null {
  if (selectedObjectId && objects.some((object) => object.id === selectedObjectId)) {
    return selectedObjectId;
  }

  return objects[0]?.id ?? null;
}

function findObjectById(objects: GraphObject[], id: string): GraphObject | null {
  return objects.find((object) => object.id === id) ?? null;
}

function updateParametricCurveField(
  object: ParametricCurveObject,
  field: ParametricExpressionField,
  value: string | number
): ParametricCurveObject | null {
  if (field === "xExpr" || field === "yExpr" || field === "zExpr") {
    return {
      ...object,
      [field]: String(value)
    };
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  if (field === "samples") {
    return {
      ...object,
      samples: Math.max(2, Math.floor(parsedValue))
    };
  }

  return {
    ...object,
    [field]: parsedValue
  };
}

function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function sanitizePartialDomain(partialDomain: Partial<SurfaceDomain>): Partial<SurfaceDomain> {
  const nextDomain: Partial<SurfaceDomain> = {};

  if (isFiniteNumber(partialDomain.xMin)) {
    nextDomain.xMin = partialDomain.xMin;
  }

  if (isFiniteNumber(partialDomain.xMax)) {
    nextDomain.xMax = partialDomain.xMax;
  }

  if (isFiniteNumber(partialDomain.yMin)) {
    nextDomain.yMin = partialDomain.yMin;
  }

  if (isFiniteNumber(partialDomain.yMax)) {
    nextDomain.yMax = partialDomain.yMax;
  }

  return nextDomain;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isSurfaceGraphObject(object: GraphObject): object is SurfaceGraphObject {
  return object.kind === "surface";
}

export function isParametricCurveObject(object: GraphObject): object is ParametricCurveObject {
  return object.kind === "parametricCurve";
}

export function isPlaneGraphObject(object: GraphObject): object is PlaneGraphObject {
  return object.kind === "plane";
}
