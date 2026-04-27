import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { applySceneCommand } from "@/lib/scene/applyCommand";
import { fitParametricSketch, fitParametricSketch3d, formatPolynomialExpression } from "@/lib/math/fitParametricSketch";
import type { GraphStoreSet, GraphStoreState } from "./graphStoreTypes";

export function buildSketchStrokesSlice(set: GraphStoreSet): Pick<
  GraphStoreState,
  "addSketchedParametricFromStroke" | "addSketchedParametricFromStroke3d"
> {
  return {
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
          yExpr = "0";
          zExpr = vPoly;
        } else if (pair === "xz") {
          xExpr = hPoly;
          yExpr = vPoly;
          zExpr = "0";
        } else {
          xExpr = "0";
          yExpr = vPoly;
          zExpr = hPoly;
        }

        const tMin = 0;
        const tMax = 1;
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

        const tMin = 0;
        const tMax = 1;
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
  };
}
