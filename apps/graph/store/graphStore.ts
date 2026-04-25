import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SceneSnapshot } from "@/lib/types/scene";
import type {
  GraphObject,
  GraphObjectKind,
  ParametricCurveObject,
  PlaneGraphObject,
  SurfaceDomain,
  SurfaceGraphObject,
  SurfaceOrientation
} from "@vinculum/scene/types";
import { normalizeSurfaceResolution } from "@vinculum/scene/defaults";
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
import {
  DEFAULT_VIEWPORT_SCALE,
  sanitizeViewportPatch
} from "@/lib/graph/viewport";
import {
  loadStoredAccentPreset,
  loadStoredDensity,
  loadStoredThemeMode,
  persistAccentPreset,
  persistDensity,
  persistThemeMode
} from "@/lib/theme/themeStorage";
import type {
  Active2dViewportSlot,
  Axis2DPair,
  Canvas2DTool,
  Canvas3DTool,
  GraphUiState,
  SceneDialogMode,
  Viewport2D,
  Viewport2DFrame
} from "@/types/graphUi";
import {
  fitParametricSketch,
  fitParametricSketch3d,
  formatPolynomialExpression
} from "@/lib/math/fitParametricSketch";

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
  updateSurfaceOrientation: (id: string, orientation: SurfaceOrientation) => void;
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
  requestCameraReset: () => void;
  setGraphMode: (mode: GraphUiState["graphMode"]) => void;
  setAxis2DPair: (pair: Axis2DPair) => void;
  setActive2dViewport: (slot: Active2dViewportSlot) => void;
  setThemeMode: (mode: GraphUiState["themeMode"]) => void;
  setAccentPreset: (preset: GraphUiState["accentPreset"]) => void;
  setDensity: (density: GraphUiState["density"]) => void;
  hydrateThemeMode: () => void;
  hydrateAccentPreset: () => void;
  hydrateDensity: () => void;
  cycleThemeMode: () => void;
  updateViewport2D: (viewport: Partial<Viewport2D>) => void;
  updateViewport2DQuadTop: (viewport: Partial<Viewport2D>) => void;
  setViewport2DFrame: (frame: Viewport2DFrame) => void;
  setViewport2DQuadTopFrame: (frame: Viewport2DFrame) => void;
  resetViewport2D: () => void;
  resetViewport2DQuadTop: () => void;
  setCanvas2dTool: (tool: Canvas2DTool) => void;
  setCanvas3dTool: (tool: Canvas3DTool) => void;
  setProbePinnedMath: (point: { horizontal: number; vertical: number } | null) => void;
  setProbePinnedWorld: (point: { x: number; y: number; z: number } | null) => void;
  clearProbes: () => void;
  setSketchExtendFraction: (fraction: number) => void;
  setSketchAutoCreate: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapStep: (step: number) => void;
  applySceneSnapshot: (snapshot: SceneSnapshot) => void;
  addSketchedParametricFromStroke: (
    stroke: { horizontal: number; vertical: number }[],
    axisPair?: Axis2DPair
  ) => string;
  addSketchedParametricFromStroke3d: (stroke: { x: number; y: number; z: number }[]) => string;
}

const initialScene = createInitialSceneDocument();

export const useGraphStore = create<GraphStoreState>()(
  persist(
    (set) => ({
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

  updateSurfaceOrientation: (id, orientation) => {
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
            orientation
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

    const safeResolution = normalizeSurfaceResolution(resolution);

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
        canvas2dTool: "pan",
        canvas3dTool: "pan",
        probePinnedMaths: [],
        probePinnedWorlds: [],
        sketchExtendFraction: 0.15,
        sketchAutoCreate: true,
        snapEnabled: true,
        snapStep: 0.25,
        density: state.ui.density,
        sceneDialog: {
          ...state.ui.sceneDialog,
          isOpen: false,
          error: null,
          jsonText: ""
        },
        active2dViewport: "primary",
        axis2dPairQuadTop: "xz"
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

  requestCameraReset: () => {
    set((state) => ({ cameraResetVersion: state.cameraResetVersion + 1 }));
  },

  setGraphMode: (mode) => {
    set((state) => {
      if (state.ui.graphMode === mode) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          graphMode: mode,
          ...(mode === "3d"
            ? {
                canvas2dTool: "pan" as const,
                probePinnedMaths: []
              }
            : {
                canvas3dTool: "pan" as const,
                probePinnedWorlds: []
              })
        },
        cameraResetVersion: mode === "3d" ? state.cameraResetVersion + 1 : state.cameraResetVersion
      };
    });
  },

  setAxis2DPair: (pair) => {
    set((state) => {
      if (state.ui.active2dViewport === "quadTop") {
        return {
          ui: {
            ...state.ui,
            axis2dPairQuadTop: pair
          }
        };
      }

      const probePinnedMaths = state.ui.probePinnedWorlds.map((p) =>
        projectWorldTo2dPair(p, pair)
      );
      return {
        ui: {
          ...state.ui,
          axis2dPair: pair,
          probePinnedMaths
        }
      };
    });
  },

  setActive2dViewport: (slot) => {
    set((state) => {
      if (state.ui.active2dViewport === slot) {
        return state;
      }
      return {
        ui: {
          ...state.ui,
          active2dViewport: slot
        }
      };
    });
  },

  setThemeMode: (mode) => {
    persistThemeMode(mode);
    set((state) => ({
      ui: {
        ...state.ui,
        themeMode: mode
      }
    }));
  },

  setAccentPreset: (preset) => {
    persistAccentPreset(preset);
    set((state) => ({
      ui: {
        ...state.ui,
        accentPreset: preset
      }
    }));
  },
  setDensity: (density) => {
    persistDensity(density);
    set((state) => ({
      ui: {
        ...state.ui,
        density
      }
    }));
  },

  hydrateThemeMode: () => {
    const mode = loadStoredThemeMode();
    set((state) => {
      if (state.ui.themeMode === mode) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          themeMode: mode
        }
      };
    });
  },

  hydrateAccentPreset: () => {
    const preset = loadStoredAccentPreset();
    set((state) => {
      if (state.ui.accentPreset === preset) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          accentPreset: preset
        }
      };
    });
  },
  hydrateDensity: () => {
    const density = loadStoredDensity();
    set((state) => {
      if (state.ui.density === density) {
        return state;
      }
      return {
        ui: {
          ...state.ui,
          density
        }
      };
    });
  },

  cycleThemeMode: () => {
    set((state) => {
      const nextThemeMode = getNextThemeMode(state.ui.themeMode);
      persistThemeMode(nextThemeMode);

      return {
        ui: {
          ...state.ui,
          themeMode: nextThemeMode
        }
      };
    });
  },

  updateViewport2D: (viewport) => {
    set((state) => {
      const nextViewport = sanitizeViewportPatch(state.ui.viewport2d, viewport);
      if (
        nextViewport.centerX === state.ui.viewport2d.centerX &&
        nextViewport.centerY === state.ui.viewport2d.centerY &&
        nextViewport.scale === state.ui.viewport2d.scale
      ) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          viewport2d: nextViewport
        }
      };
    });
  },

  setViewport2DFrame: (frame) => {
    set((state) => ({
      ui: {
        ...state.ui,
        viewport2dFrame: {
          width: Math.max(0, Math.floor(frame.width)),
          height: Math.max(0, Math.floor(frame.height))
        }
      }
    }));
  },

  setViewport2DQuadTopFrame: (frame) => {
    set((state) => ({
      ui: {
        ...state.ui,
        viewport2dQuadTopFrame: {
          width: Math.max(0, Math.floor(frame.width)),
          height: Math.max(0, Math.floor(frame.height))
        }
      }
    }));
  },

  resetViewport2D: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        viewport2d: createDefaultViewport2D()
      }
    }));
  },

  resetViewport2DQuadTop: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        viewport2dQuadTop: createDefaultViewport2D()
      }
    }));
  },

  updateViewport2DQuadTop: (viewport) => {
    set((state) => {
      const nextViewport = sanitizeViewportPatch(state.ui.viewport2dQuadTop, viewport);
      if (
        nextViewport.centerX === state.ui.viewport2dQuadTop.centerX &&
        nextViewport.centerY === state.ui.viewport2dQuadTop.centerY &&
        nextViewport.scale === state.ui.viewport2dQuadTop.scale
      ) {
        return state;
      }

      return {
        ui: {
          ...state.ui,
          viewport2dQuadTop: nextViewport
        }
      };
    });
  },

  setCanvas2dTool: (tool) => {
    set((state) => ({
      ui: {
        ...state.ui,
        canvas2dTool: tool
      }
    }));
  },

  setCanvas3dTool: (tool) => {
    set((state) => ({
      ui: {
        ...state.ui,
        canvas3dTool: tool
      }
    }));
  },

  setProbePinnedMath: (point) => {
    set((state) => {
      if (!point) {
        return state;
      }
      const worldPoint = project2dPairToWorld(point, state.ui.axis2dPair);
      return {
        ui: {
          ...state.ui,
          probePinnedMaths: [...state.ui.probePinnedMaths, point],
          probePinnedWorlds: [...state.ui.probePinnedWorlds, worldPoint]
        }
      };
    });
  },

  setProbePinnedWorld: (point) => {
    set((state) => {
      if (!point) {
        return state;
      }
      const mathPoint = projectWorldTo2dPair(point, state.ui.axis2dPair);
      return {
        ui: {
          ...state.ui,
          probePinnedWorlds: [...state.ui.probePinnedWorlds, point],
          probePinnedMaths: [...state.ui.probePinnedMaths, mathPoint]
        }
      };
    });
  },

  clearProbes: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        probePinnedMaths: [],
        probePinnedWorlds: []
      }
    }));
  },

  setSketchExtendFraction: (fraction) => {
    if (!Number.isFinite(fraction)) {
      return;
    }

    const clamped = Math.min(0.45, Math.max(0, fraction));
    set((state) => ({
      ui: {
        ...state.ui,
        sketchExtendFraction: clamped
      }
    }));
  },

  setSketchAutoCreate: (enabled) => {
    set((state) => ({
      ui: {
        ...state.ui,
        sketchAutoCreate: enabled
      }
    }));
  },

  setSnapEnabled: (enabled) => {
    set((state) => ({
      ui: {
        ...state.ui,
        snapEnabled: enabled
      }
    }));
  },

  setSnapStep: (step) => {
    if (!Number.isFinite(step)) {
      return;
    }
    set((state) => ({
      ui: {
        ...state.ui,
        snapStep: Math.min(100, Math.max(0.0001, step))
      }
    }));
  },

  applySceneSnapshot: (snapshot) => {
    set((state) => ({
      scene: {
        ...state.scene,
        objects: snapshot.objects
      },
      ui: {
        ...state.ui,
        selectedObjectId: resolveSelectedObjectId(snapshot.selection.selectedObjectId, snapshot.objects)
      }
    }));
  },

  addSketchedParametricFromStroke: (stroke, axisPairOverride) => {
    let createdObjectId = "";

    set((state) => {
      const fit = fitParametricSketch(stroke);
      if (!fit) {
        return state;
      }

      const pair = axisPairOverride ?? state.ui.axis2dPair;
      const hPoly = formatPolynomialExpression(fit.horizontalCoeffs, "t");
      const vPoly = formatPolynomialExpression(fit.verticalCoeffs, "t");

      let xExpr = "0";
      let yExpr = "0";
      let zExpr = "0";

      if (pair === "xy") {
        xExpr = hPoly;
        yExpr = vPoly;
        zExpr = "0";
      } else if (pair === "xz") {
        xExpr = hPoly;
        zExpr = vPoly;
        yExpr = "0";
      } else {
        yExpr = hPoly;
        zExpr = vPoly;
        xExpr = "0";
      }

      const extend = state.ui.sketchExtendFraction;
      const tMin = 0 - extend;
      const tMax = 1 + extend;
      const samples = Math.min(720, Math.max(160, Math.round(200 + fit.degree * 48)));

      const nextObject = createParametricCurve({
        colorIndex: state.scene.objects.length,
        xExpr,
        yExpr,
        zExpr,
        tMin,
        tMax,
        samples
      });

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
          selectedObjectId: nextObject.id,
          canvas2dTool: "pan"
        }
      };
    });

    return createdObjectId;
  },

  addSketchedParametricFromStroke3d: (stroke) => {
    let createdObjectId = "";

    set((state) => {
      const fit = fitParametricSketch3d(stroke);
      if (!fit) {
        return state;
      }

      const extend = state.ui.sketchExtendFraction;
      const tMin = 0 - extend;
      const tMax = 1 + extend;
      const samples = Math.min(720, Math.max(160, Math.round(200 + fit.degree * 48)));

      const nextObject = createParametricCurve({
        colorIndex: state.scene.objects.length,
        xExpr: formatPolynomialExpression(fit.xCoeffs, "t"),
        yExpr: formatPolynomialExpression(fit.yCoeffs, "t"),
        zExpr: formatPolynomialExpression(fit.zCoeffs, "t"),
        tMin,
        tMax,
        samples
      });
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
          selectedObjectId: nextObject.id,
          canvas3dTool: "pan"
        }
      };
    });

    return createdObjectId;
  }
}),
    {
      name: "vinculum-graph-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        scene: state.scene,
        ui: {
          ...state.ui,
          sceneDialog: {
            isOpen: false,
            mode: state.ui.sceneDialog.mode,
            jsonText: "",
            error: null
          }
        }
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object" || !("scene" in persisted)) {
          return current as GraphStoreState;
        }
        const { scene, ui } = persisted as { scene: SceneDocument; ui?: GraphUiState };
        if (!scene?.objects) {
          return current as GraphStoreState;
        }
        const mergedUi = ui ?? (current as GraphStoreState).ui;
        return {
          ...(current as GraphStoreState),
          scene,
          ui: {
            ...(current as GraphStoreState).ui,
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
      },
      skipHydration: true
    }
  )
);

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
  return createSceneDocument({
    metadata: {
      name: DEFAULT_SCENE_NAME
    },
    objects: []
  });
}

function createDefaultViewport2D(): Viewport2D {
  return {
    centerX: 0,
    centerY: 0,
    scale: DEFAULT_VIEWPORT_SCALE
  };
}

function createInitialUiState(selectedObjectId: string | null): GraphUiState {
  return {
    selectedObjectId,
    sceneDialog: {
      isOpen: false,
      mode: "export",
      jsonText: "",
      error: null
    },
    graphMode: "3d",
    themeMode: "system",
    accentPreset: "indigo",
    density: "balanced",
    axis2dPair: "xy",
    axis2dPairQuadTop: "xz",
    active2dViewport: "primary",
    viewport2d: createDefaultViewport2D(),
    viewport2dFrame: {
      width: 0,
      height: 0
    },
    viewport2dQuadTop: createDefaultViewport2D(),
    viewport2dQuadTopFrame: {
      width: 0,
      height: 0
    },
    canvas2dTool: "pan",
    canvas3dTool: "pan",
    probePinnedMaths: [],
    probePinnedWorlds: [],
    sketchExtendFraction: 0.15,
    sketchAutoCreate: true,
    snapEnabled: true,
    snapStep: 0.25
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

function project2dPairToWorld(
  point: { horizontal: number; vertical: number },
  pair: Axis2DPair
): { x: number; y: number; z: number } {
  if (pair === "xy") {
    return { x: point.horizontal, y: point.vertical, z: 0 };
  }
  if (pair === "xz") {
    return { x: point.horizontal, y: 0, z: point.vertical };
  }
  return { x: 0, y: point.horizontal, z: point.vertical };
}

function projectWorldTo2dPair(
  point: { x: number; y: number; z: number },
  pair: Axis2DPair
): { horizontal: number; vertical: number } {
  if (pair === "xy") {
    return { horizontal: point.x, vertical: point.y };
  }
  if (pair === "xz") {
    return { horizontal: point.x, vertical: point.z };
  }
  return { horizontal: point.y, vertical: point.z };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getNextThemeMode(current: GraphUiState["themeMode"]): GraphUiState["themeMode"] {
  if (current === "system") {
    return "light";
  }

  if (current === "light") {
    return "dark";
  }

  return "system";
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
