import { normalizeMathInput } from "@/lib/math/mathNotation";
import { useEditorStore } from "@/lib/store/editorStore";
import { splitSingleMathEquality } from "@/lib/math/implicitEquation";
import { validateExpressionSafety } from "@/lib/math/expressionSafety";
import { compileRustExpression } from "@/lib/math/rustMath";
import { inferGraphEquation } from "@/lib/math/inferGraphEquation";
import { getEquationParameterNames, isParameterName, getEditorParameterScope } from "@/lib/store/editorParameters";
import { parseGraphObject } from "@/lib/scene/validateSceneGraphParsers";
import { createEquationGraph } from "@/lib/graph/createEquationGraph";
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
  | "commitAutoEquation"
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
    commitAutoEquation: (equation, id) => {
      equation = normalizeMathInput(equation);
      const params = getEditorParameterScope();
      const equality = splitSingleMathEquality(equation) ?? (isParameterName(equation.trim()) ? { lhs: equation.trim(), rhs: String(params[equation.trim()] ?? 1) } : null);
      if (!id && equality && isParameterName(equality.lhs)) {
        const safety = validateExpressionSafety(equality.rhs, { operation: "define-parameter", expressionLabel: "Parameter", allowedSymbols: Object.keys(params).filter(name => name !== equality.lhs), strictSymbols: true });
        if (!safety.ok) return { id: null, error: safety.violation.message };
        try {
          const value = compileRustExpression(equality.rhs).evaluate({ ...params, pi: Math.PI, e: Math.E });
          if (!Number.isFinite(value)) return { id: null, error: "Parameter values must be finite." };
          useEditorStore.getState().setParameterDefinition(equality.lhs, value);
          return { id: null, parameterId: equality.lhs, error: null };
        } catch { return { id: null, error: "Check the parameter value." }; }
      }
      const names = getEquationParameterNames(equation);
      const provisional = { ...params };
      for (const name of names) if (!(name in provisional)) provisional[name] = 1;
      const inference = equation.trim() ? inferGraphEquation(equation, provisional) : { ok: true as const, kind: "implicitCurve" as const, dimension: "2d" as const, relation: "", orientation: "y" as const };
      if (!inference.ok) return { id: null, error: inference.error };
      let committedId: string | null = null;
      let error: string | null = null;
      set((state) => {
        const current = id ? state.scene.objects.find((object) => object.id === id) : undefined;
        if (id && !current) { error = "This equation was removed."; return state; }
        if (current && ((!current.autoExpression && current.kind !== "implicitCurve") || !("equation" in current))) { error = "This object uses a specific definition type."; return state; }
        if (current && "equation" in current && current.equation === equation) { committedId = current.id; return state; }
        const replacement = createEquationGraph(equation, inference, state.scene.objects.length, current);
        const errors: string[] = [];
        const validated = parseGraphObject(replacement, 0, errors);
        if (!validated) { error = errors.join(" "); return state; }
        committedId = validated.id;
        if (current) {
          useScalarVizResultsStore.getState().removeForSource(current.id);
          useStreamlineResultsStore.getState().removeForSource(current.id);
          useIntegralResultsStore.getState().removeForSource(current.id);
        }
        return {
          scene: applySceneCommand(state.scene, current ? { type: "UPDATE_OBJECT", payload: { object: validated } } : { type: "ADD_OBJECT", payload: { object: validated } }),
          ui: { ...(current ? pruneGeometryAnalysisForSourceId(clearIntegralFieldSelection(clearAllDerivedForSource(state.ui, current.id), current.id), current.id) : state.ui), selectedObjectId: validated.id }
        };
      });
      if (committedId && !error) useEditorStore.getState().ensureParameters(names);
      return { id: committedId, error, dimension: inference.dimension };
    },
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
      return appendObject(set, (index) => ({ ...createEquationGraph("", { ok: true, kind: "implicitCurve", dimension: "2d", relation: "", orientation: "y" }, index) }));
    },

    insertObjectAfter: (id, kind, dimension) => {
      let createdObjectId = "";

      set((state) => {
        const source = state.scene.objects.find((object) => object.id === id);
        const nextObject = source?.autoExpression || source?.kind === "implicitCurve" ? createEmptyGraphObject("implicitCurve", state.scene.objects.length) : createGraphObject(kind, state.scene.objects.length, { dimension });
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
