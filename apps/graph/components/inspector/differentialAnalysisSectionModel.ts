import type { ImplicitSurfaceObject, SurfaceGraphObject } from "@vinculum/scene/types";
import type { DifferentialAnalysisState } from "@/types/graphUi";
import { analysisSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";
import {
  computeSurfaceAnalysis,
  type SurfaceGradient
} from "@/lib/math/surfaceDifferential";

// Pure view-model for the Differential Analysis inspector section (and its
// unit tests). Source identity is the shared math-only helper (S21-R1), so
// the model, the pick path, and the overlay sync can never drift apart.

export type AnalysisSectionBody =
  | { body: "empty"; pickEnabled: boolean }
  | { body: "pending" }
  | {
      body: "values";
      point: { x: number; y: number; z: number };
      gradient: SurfaceGradient;
      showNormal: boolean;
      showTangent: boolean;
    }
  | { body: "diagnostic"; message: string; repick: boolean };

export type AnalysisSectionModel = AnalysisSectionBody & {
  stale: boolean;
};

export function isAnalysisSourceCompilable(object: SurfaceGraphObject | ImplicitSurfaceObject): boolean {
  if (object.kind === "surface") {
    return compileSurfaceExpression(object.equation, object.orientation ?? "z").error === null;
  }
  return (
    compileImplicitSurfaceExpression(object.equation, getEditorParameterScope()).error === null
  );
}

export function resolveAnalysisSectionModel(input: {
  object: SurfaceGraphObject | ImplicitSurfaceObject;
  record: DifferentialAnalysisState | undefined;
  computeStatus: "idle" | "pending" | "error";
}): AnalysisSectionModel {
  const { object, record, computeStatus } = input;
  if (!record) {
    return { body: "empty", pickEnabled: isAnalysisSourceCompilable(object), stale: false };
  }
  if (computeStatus !== "idle") {
    return { body: "pending", stale: false };
  }
  if (analysisSourceIdentity(object) !== record.structure) {
    return {
      body: "diagnostic",
      message: "Source changed — pick again to refresh.",
      repick: false,
      stale: true
    };
  }
  const outcome = computeSurfaceAnalysis(object, record.point, getEditorParameterScope());
  switch (outcome.status) {
    case "ok":
      return {
        body: "values",
        point: record.point,
        gradient: outcome.gradient,
        showNormal: record.showNormal,
        showTangent: record.showTangent,
        stale: false
      };
    case "derivative-unavailable":
      return { body: "diagnostic", message: outcome.error, repick: false, stale: false };
    case "non-finite":
      return {
        body: "diagnostic",
        message: "Derivatives are not finite at this point.",
        repick: false,
        stale: false
      };
    case "zero-gradient":
      return {
        body: "diagnostic",
        message: "Tangent plane unavailable: gradient is zero at this point.",
        repick: false,
        stale: false
      };
    case "off-surface":
      return {
        body: "diagnostic",
        message: "Point left the surface — pick again.",
        repick: true,
        stale: false
      };
    case "invalid-source":
      return { body: "diagnostic", message: outcome.error, repick: false, stale: false };
  }
}
