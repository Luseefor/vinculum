import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { createLinearTransformGraph } from "@/lib/graph/createLinearTransformGraph";
import { convertLinearTransformDimension } from "./graphStoreLinearTransformField";
import {
  createLineGraph,
  createRayGraph,
  createSegmentGraph,
  createVectorGraph
} from "@/lib/graph/createGeometryPrimitiveGraphs";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createPointGraph } from "@/lib/graph/createPointGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { SceneCommand } from "@/lib/scene/commands";
import { appendObject } from "./graphStoreAppendObject";
import {
  createEmptyGraphObject,
  createGraphObject,
  isGraphObjectWithoutExpressions
} from "./graphStoreObjectFactory";
import { clearAllDerivedForSource } from "./graphStoreSliceScalarViz";
import { pruneGeometryAnalysisForSourceId } from "./graphStoreSliceGeometryAnalysis";
import { pruneLinearTransformAnalysisForSourceId } from "./graphStoreSliceLinearTransform";
import { clearIntegralFieldSelection, integralSourcesReferencingField } from "./graphStoreSliceIntegral";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildObjectsSliceInsert(set: GraphStoreSet): Pick<
  GraphStoreState,
  | "addDefinedObject"
  | "addSurfaceObject"
  | "addParametricCurve"
  | "addPlaneObject"
  | "addParametricSurface"
  | "addImplicitSurface"
  | "addVectorFieldObject"
  | "addPointObject"
  | "addLinearTransformObject"
  | "addVectorObject"
  | "addLineObject"
  | "addRayObject"
  | "addSegmentObject"
  | "addEmptyObject"
  | "insertObjectAfter"
  | "setObjectKind"
> {
  return {
    addDefinedObject: (object) => {
      // Internal insertion of a definition validated by the canonical parser.
      const id = appendObject(set, () => object);
      return id ? { id, error: null } : { id: null, error: "An object with this ID already exists." };
    },
    addSurfaceObject: () => {
      return appendObject(set, (index) => createSurfaceGraph({ colorIndex: index }));
    },

    addParametricCurve: () => {
      return appendObject(set, (index) => createParametricCurve({ colorIndex: index }));
    },

    addPlaneObject: () => {
      return appendObject(set, (index) => createPlaneGraph({ colorIndex: index }));
    },

    addParametricSurface: () => {
      return appendObject(set, (index) => createParametricSurfaceGraph({ colorIndex: index }));
    },

    addImplicitSurface: () => {
      return appendObject(set, (index) => createImplicitSurfaceGraph({ colorIndex: index }));
    },

    addVectorFieldObject: (dimension) => {
      return appendObject(set, (index) => createVectorFieldGraph({ colorIndex: index, dimension }));
    },

    addPointObject: () => {
      return appendObject(set, (index) => createPointGraph({ colorIndex: index }));
    },

    addLinearTransformObject: (dimension) => {
      return appendObject(set, (index) => createLinearTransformGraph({ colorIndex: index, dimension }));
    },

    addVectorObject: () => {
      return appendObject(set, (index) => createVectorGraph({ colorIndex: index }));
    },

    addLineObject: () => {
      return appendObject(set, (index) => createLineGraph({ colorIndex: index }));
    },

    addRayObject: () => {
      return appendObject(set, (index) => createRayGraph({ colorIndex: index }));
    },

    addSegmentObject: () => {
      return appendObject(set, (index) => createSegmentGraph({ colorIndex: index }));
    },

    addEmptyObject: () => {
      return appendObject(set, (index) => createSurfaceGraph({ colorIndex: index, equation: "" }));
    },

    insertObjectAfter: (id, kind, dimension) => {
      let createdObjectId = "";

      set((state) => {
        const nextObject = createGraphObject(kind, state.scene.objects.length, { dimension });
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

    setObjectKind: (id, kind, dimension) => {
      set((state) => {
        const index = state.scene.objects.findIndex((object) => object.id === id);
        if (index === -1) {
          return state;
        }

        const currentObject = state.scene.objects[index];
        // S28 PART 41: linearTransform dimension switches preserve
        // entries deterministically (2D→3D embeds on XY with z fixed;
        // 3D→2D keeps the top-left 2×2) instead of rebuilding defaults.
        // This branch precedes the generic same-kind early return below.
        if (currentObject.kind === "linearTransform" && kind === "linearTransform") {
          const targetDimension = dimension === "3d" ? "3d" : dimension === "2d" ? "2d" : currentObject.dimension;
          if (targetDimension === currentObject.dimension) {
            return state;
          }
          const converted = convertLinearTransformDimension(currentObject, targetDimension);
          const dimensionCommand: SceneCommand = {
            type: "UPDATE_OBJECT",
            payload: {
              object: converted
            }
          };
          useScalarVizResultsStore.getState().removeForSource(id);
          useStreamlineResultsStore.getState().removeForSource(id);
          useIntegralResultsStore.getState().removeForSource(id);
          const uiWithoutGeometry = pruneGeometryAnalysisForSourceId(state.ui, id);
          return {
            scene: applySceneCommand(state.scene, dimensionCommand),
            ui: pruneLinearTransformAnalysisForSourceId(
              clearIntegralFieldSelection(clearAllDerivedForSource(uiWithoutGeometry, id), id),
              id
            )
          };
        }
        // Vector conversions need a dimension: explicit choice wins, else
        // preserve the current field's dimension, else default to 2D.
        const vectorDimension =
          dimension ??
          (currentObject.kind === "vectorField" ? currentObject.dimension : "2d");
        const currentDimension =
          currentObject.kind === "vectorField" ? currentObject.dimension : null;
        // Same kind AND same dimension: nothing to convert (S22: a 2D<->3D
        // dimension switch rebuilds defaults and clears attached analysis).
        if (currentObject.kind === kind && (currentDimension === null || vectorDimension === currentDimension)) {
          return state;
        }
        const objectOptions = {
          id: currentObject.id,
          color: currentObject.color,
          visible: currentObject.visible,
          ...(kind === "vectorField" ? { dimension: vectorDimension } : {})
        };

        // S23: kind switches drop cached scalar grids with the config.
        // S24: same for cached streamlines (no stale trajectories).
        // S25: same for integral results; referencing configs lose their
        // field selection below.
        useScalarVizResultsStore.getState().removeForSource(id);
        useStreamlineResultsStore.getState().removeForSource(id);
        useIntegralResultsStore.getState().removeForSource(id);
        const replacement = isGraphObjectWithoutExpressions(currentObject)
          ? createEmptyGraphObject(kind, index, objectOptions)
          : createGraphObject(kind, index, objectOptions);

        const command: SceneCommand = {
          type: "UPDATE_OBJECT",
          payload: {
            object: replacement
          }
        };

        for (const sourceId of integralSourcesReferencingField(state.ui, id)) {
          useIntegralResultsStore.getState().removeForSource(sourceId);
        }
        // S27: kind switches drop the converted source's geometry
        // analysis and any analysis referencing it (overlays GC in tick).
        // S28: same for linearTransform analysis (transform or vector).
        const uiWithoutGeometry = pruneGeometryAnalysisForSourceId(state.ui, id);
        return {
          scene: applySceneCommand(state.scene, command),
          ui: pruneLinearTransformAnalysisForSourceId(
            clearIntegralFieldSelection(clearAllDerivedForSource(uiWithoutGeometry, id), id),
            id
          )
        };
      });
    }
  };
}
