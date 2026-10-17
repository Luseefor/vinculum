import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { matchPaletteCommand } from "@/components/editor/CommandPalette";
import AnalysisInspector from "@/components/inspector/AnalysisInspector";
import { CONVERT_OPTIONS } from "@/components/objects/ObjectRowContextMenu";
import {
  OBJECT_DESCRIPTORS,
  descriptorByCommandId,
  descriptorByKey,
  moreAddDescriptors,
  quickAddDescriptors
} from "@/lib/objects/objectDescriptors";
import {
  createBoxPlateauPreset,
  createCylinderPreset,
  createCylinderShellPreset,
  createImplicitSpherePreset,
  createImplicitTorusPreset,
  createObjectByKey,
  createParametricSpherePreset,
  createParametricTorusPreset,
  createProjectionPreset,
  createSlicePlanePreset,
  createSphereCapPreset,
  createSpherePreset
} from "@/lib/objects/objectCreation";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { useEditorStore } from "@/lib/store/editorStore";
import { validateSceneDocument } from "@/lib/scene/validateScene";
import { serializeScene } from "@/lib/scene/serializeScene";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import {
  buildScalarFieldJob,
  createScalarSyncTestContext,
  pumpScalarVizJobs
} from "@/lib/compute/scalarVizSync";
import {
  buildStreamlineJob,
  createStreamlineSyncTestContext,
  pumpStreamlineJobs
} from "@/lib/compute/streamlineSync";
import {
  buildIntegralJob,
  createIntegralSyncTestContext,
  pumpIntegralJobs
} from "@/lib/compute/integralSync";
import { scalarVizMathIdentity } from "@/store/graphStoreSliceScalarViz";
import { vectorCalculusSourceIdentity } from "@/store/graphStoreSliceAnalysis";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import { useIntegralResultsStore } from "@/lib/compute/integralResults";
import { useGraphStore } from "@/store/graphStore";
import type { GraphObject } from "@vinculum/scene/types";

function liveObject(id: string): GraphObject {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object missing");
  }
  return object;
}

function resetAll(): void {
  useGraphStore.getState().resetScene();
  useScalarVizResultsStore.getState().clearAll();
  useStreamlineResultsStore.getState().clearAll();
  useIntegralResultsStore.getState().clearAll();
}

describe("S30 descriptors: one metadata source for all creation surfaces", () => {
  it("covers all 14 creation entries with unique keys, labels, and command ids", () => {
    expect(OBJECT_DESCRIPTORS).toHaveLength(14);
    const keys = OBJECT_DESCRIPTORS.map((entry) => entry.key);
    const labels = OBJECT_DESCRIPTORS.map((entry) => entry.label);
    const commandIds = OBJECT_DESCRIPTORS.map((entry) => entry.commandId);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(commandIds).size).toBe(commandIds.length);
  });

  it("covers all 12 canonical kinds (fields and transforms in both dimensions)", () => {
    const kinds = new Set(OBJECT_DESCRIPTORS.map((entry) => entry.kind));
    for (const kind of [
      "surface",
      "parametricCurve",
      "plane",
      "parametricSurface",
      "implicitSurface",
      "vectorField",
      "point",
      "vector",
      "line",
      "ray",
      "segment",
      "linearTransform"
    ] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(OBJECT_DESCRIPTORS.filter((entry) => entry.kind === "vectorField")).toHaveLength(2);
    expect(OBJECT_DESCRIPTORS.filter((entry) => entry.kind === "linearTransform")).toHaveLength(2);
  });

  it("keeps Quick Add at six per workspace with everything else behind More", () => {
    expect(quickAddDescriptors("geometry")).toHaveLength(6);
    expect(quickAddDescriptors("math")).toHaveLength(6);
    for (const workspace of ["geometry", "math"] as const) {
      const reachable = new Set([
        ...quickAddDescriptors(workspace).map((entry) => entry.key),
        ...moreAddDescriptors(workspace).map((entry) => entry.key)
      ]);
      expect(reachable.size).toBe(OBJECT_DESCRIPTORS.length);
    }
  });

  it("resolves descriptors by key and command id", () => {
    expect(descriptorByKey("parametricCurve")?.label).toBe("Parametric Curve");
    expect(descriptorByCommandId("add-curve")?.label).toBe("Parametric Curve");
    expect(descriptorByKey("nope")).toBeNull();
    expect(descriptorByCommandId("nope")).toBeNull();
  });
});

describe("S30 creation parity: every descriptor key creates a valid canonical object", () => {
  beforeEach(() => {
    resetAll();
  });

  it("creates all 14 kinds through the central path", () => {
    const expectations: Array<{ key: string; kind: GraphObject["kind"]; dimension?: string }> = [
      { key: "surface", kind: "surface" },
      { key: "parametricCurve", kind: "parametricCurve" },
      { key: "parametricSurface", kind: "parametricSurface" },
      { key: "implicitSurface", kind: "implicitSurface" },
      { key: "vectorField-2d", kind: "vectorField", dimension: "2d" },
      { key: "vectorField-3d", kind: "vectorField", dimension: "3d" },
      { key: "plane", kind: "plane" },
      { key: "point", kind: "point" },
      { key: "vector", kind: "vector" },
      { key: "line", kind: "line" },
      { key: "ray", kind: "ray" },
      { key: "segment", kind: "segment" },
      { key: "linearTransform-2d", kind: "linearTransform", dimension: "2d" },
      { key: "linearTransform-3d", kind: "linearTransform", dimension: "3d" }
    ];
    for (const expected of expectations) {
      const id = createObjectByKey(expected.key);
      expect(id).not.toBe("");
      const object = liveObject(id);
      expect(object.kind).toBe(expected.kind);
      if (expected.dimension) {
        expect((object as { dimension?: string }).dimension).toBe(expected.dimension);
      }
    }
    // The whole batch validates through the canonical import path.
    const scene = createSceneDocument({
      metadata: { name: "s30-parity" },
      objects: useGraphStore.getState().scene.objects,
      measurements: []
    });
    expect(validateSceneDocument(JSON.parse(serializeScene(scene))).valid).toBe(true);
  });

  it("rejects unknown descriptor keys without mutating the scene", () => {
    const before = useGraphStore.getState().scene.objects.length;
    expect(createObjectByKey("nope")).toBe("");
    expect(useGraphStore.getState().scene.objects.length).toBe(before);
  });
});

describe("S30 presets: single payload source, byte-identical behavior", () => {
  beforeEach(() => {
    resetAll();
  });

  it("builds every template preset with its canonical payload", () => {
    const sphere = liveObject(createSpherePreset());
    expect(sphere.kind).toBe("surface");
    if (sphere.kind === "surface") {
      expect(sphere.equation).toBe("sqrt(max(0, 9 - x^2 - y^2))");
      expect(sphere.domain).toMatchObject({ xMin: -3, xMax: 3, yMin: -3, yMax: 3 });
    }
    const cylinder = liveObject(createCylinderPreset());
    if (cylinder.kind === "surface") {
      expect(cylinder.equation).toBe("sqrt(max(0, 4 - x^2))");
    }
    const cap = liveObject(createSphereCapPreset());
    if (cap.kind === "surface") {
      expect(cap.equation).toContain("sqrt");
    }
    const shell = liveObject(createCylinderShellPreset());
    if (shell.kind === "surface") {
      expect(shell.equation).toContain("sqrt");
    }
    const plateau = liveObject(createBoxPlateauPreset());
    if (plateau.kind === "surface") {
      expect(plateau.equation).toBe("1");
    }
    const parametricSphere = liveObject(createParametricSpherePreset());
    if (parametricSphere.kind === "parametricSurface") {
      expect(parametricSphere.xExpr).toBe("sin(u) * cos(v)");
    }
    const parametricTorus = liveObject(createParametricTorusPreset());
    if (parametricTorus.kind === "parametricSurface") {
      expect(parametricTorus.zExpr).toBe("0.5 * sin(v)");
    }
    const implicitSphere = liveObject(createImplicitSpherePreset());
    if (implicitSphere.kind === "implicitSurface") {
      expect(implicitSphere.equation).toBe("x^2 + y^2 + z^2 = 1");
    }
    const implicitTorus = liveObject(createImplicitTorusPreset());
    if (implicitTorus.kind === "implicitSurface") {
      expect(implicitTorus.equation).toContain("3.75");
    }
    const slice = liveObject(createSlicePlanePreset());
    if (slice.kind === "plane") {
      expect(slice.equation).toBe("z = 0");
    }
  });

  it("projects the selected curve and guards without one", () => {
    expect(createProjectionPreset()).toBeNull();
    const store = useGraphStore.getState();
    const id = store.addParametricCurve();
    store.selectObject(id);
    const projected = createProjectionPreset();
    expect(projected).not.toBeNull();
    if (projected) {
      const object = liveObject(projected);
      if (object.kind === "parametricCurve") {
        expect(object.zExpr).toBe("0");
      } else {
        throw new Error("expected parametricCurve");
      }
    }
  });
});

describe("S30 palette matching: categories with mathematical aliases", () => {
  it("matches mathematical synonyms, not just labels", () => {
    const matrix = descriptorByCommandId("add-2d-linear-transform");
    expect(matrix).not.toBeNull();
    if (!matrix) {
      throw new Error("missing descriptor");
    }
    const command = { id: matrix.commandId, label: matrix.commandLabel, category: "Create" as const, aliases: matrix.aliases };
    expect(matchPaletteCommand(command, "matrix")).toBe(true);
    expect(matchPaletteCommand(command, "eigen")).toBe(true);
    expect(matchPaletteCommand(command, "")).toBe(true);
    expect(matchPaletteCommand(command, "zzz")).toBe(false);
  });

  it("finds fields by flow and curves by curve", () => {
    const field = descriptorByCommandId("add-3d-vector-field");
    const curve = descriptorByCommandId("add-curve");
    if (!field || !curve) {
      throw new Error("missing descriptors");
    }
    expect(
      matchPaletteCommand({ id: field.commandId, label: field.commandLabel, category: "Create", aliases: field.aliases }, "flow")
    ).toBe(true);
    expect(
      matchPaletteCommand({ id: curve.commandId, label: curve.commandLabel, category: "Create", aliases: curve.aliases }, "curve")
    ).toBe(true);
  });
});

describe("S30 Convert menu: 14 Title-Case entries from descriptors", () => {
  it("lists every canonical kind with canonical casing", () => {
    expect(CONVERT_OPTIONS).toHaveLength(14);
    const labels = CONVERT_OPTIONS.map((entry) => entry.label);
    for (const label of [
      "Surface",
      "Parametric Curve",
      "Parametric Surface",
      "Implicit Surface",
      "Plane",
      "Point",
      "Vector",
      "Infinite Line",
      "Ray",
      "Segment",
      "2D Vector Field",
      "3D Vector Field",
      "2D Linear Transformation",
      "3D Linear Transformation"
    ]) {
      expect(labels).toContain(label);
    }
    // No sentence-case stragglers from the pre-S30 menu.
    for (const label of labels) {
      expect(label).not.toMatch(/^(Parametric|Implicit|Infinite|[0-9]D) [a-z]/);
    }
  });
});

describe("S30 Analyze tab: full per-kind capability matrix", () => {
  beforeEach(() => {
    resetAll();
  });

  function renderAnalysisFor(kind: GraphObject["kind"]): void {
    const store = useGraphStore.getState();
    let id = "";
    switch (kind) {
      case "point":
        id = store.addPointObject();
        break;
      case "vectorField":
        id = store.addVectorFieldObject("2d");
        break;
      case "parametricCurve":
        id = store.addParametricCurve();
        break;
      case "parametricSurface":
        id = store.addParametricSurface();
        break;
      case "implicitSurface":
        id = store.addImplicitSurface();
        break;
      case "plane":
        id = store.addPlaneObject();
        break;
      case "linearTransform":
        id = store.addLinearTransformObject("2d");
        break;
      case "vector":
        id = store.addVectorObject();
        break;
      default:
        id = store.addSurfaceObject();
        break;
    }
    store.selectObject(id);
    render(<AnalysisInspector />);
  }

  it("point shows geometry analysis, never vector calculus or integrals", () => {
    renderAnalysisFor("point");
    expect(screen.getByTestId("geometry-analysis-section")).toBeInTheDocument();
    expect(screen.queryByTestId("vector-calculus-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("streamline-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("integral-analysis-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scalar-visualization-section")).not.toBeInTheDocument();
  });

  it("vector field shows calculus plus streamlines, never integrals", () => {
    renderAnalysisFor("vectorField");
    expect(screen.getByTestId("vector-calculus-section")).toBeInTheDocument();
    expect(screen.getByTestId("streamline-section")).toBeInTheDocument();
    expect(screen.queryByTestId("integral-analysis-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("geometry-analysis-section")).not.toBeInTheDocument();
  });

  it("surface shows differential, scalar viz, and integral in order", () => {
    renderAnalysisFor("surface");
    expect(screen.getByText("Differential Analysis")).toBeInTheDocument();
    expect(screen.getByTestId("scalar-visualization-section")).toBeInTheDocument();
    expect(screen.getByTestId("integral-analysis-section")).toBeInTheDocument();
    expect(screen.queryByTestId("vector-calculus-section")).not.toBeInTheDocument();
  });

  it("parametric curve and surface show integral only", () => {
    renderAnalysisFor("parametricCurve");
    expect(screen.getByTestId("integral-analysis-section")).toBeInTheDocument();
    expect(screen.queryByTestId("vector-calculus-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("geometry-analysis-section")).not.toBeInTheDocument();
    expect(screen.queryByText("Differential Analysis")).not.toBeInTheDocument();
  });

  it("implicit surface shows differential and scalar viz without integral", () => {
    renderAnalysisFor("implicitSurface");
    expect(screen.getByText("Differential Analysis")).toBeInTheDocument();
    expect(screen.getByTestId("scalar-visualization-section")).toBeInTheDocument();
    expect(screen.queryByTestId("integral-analysis-section")).not.toBeInTheDocument();
  });

  it("plane and vector show geometry analysis only", () => {
    renderAnalysisFor("plane");
    expect(screen.getByTestId("geometry-analysis-section")).toBeInTheDocument();
    expect(screen.queryByTestId("integral-analysis-section")).not.toBeInTheDocument();
  });

  it("vector shows geometry analysis without vector calculus", () => {
    renderAnalysisFor("vector");
    expect(screen.getByTestId("geometry-analysis-section")).toBeInTheDocument();
    expect(screen.queryByTestId("vector-calculus-section")).not.toBeInTheDocument();
  });

  it("linear transform shows properties, apply, and eigen", () => {
    renderAnalysisFor("linearTransform");
    expect(screen.getByTestId("linear-fact-determinant")).toBeInTheDocument();
    expect(screen.getByTestId("linear-fact-rank")).toBeInTheDocument();
    expect(screen.getByLabelText("Vector for transformation analysis")).toBeInTheDocument();
  });
});

describe("S30 zero-job UI: navigation storms enqueue nothing (Part 41)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("re-pumping unchanged scalar, streamline, and integral pipelines requests nothing new", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "z = x^2 + y^2");
    const fieldId = store.addVectorFieldObject("2d");
    const params = getEditorParameterScope();

    const surface = liveObject(surfaceId);
    const identity = scalarVizMathIdentity(
      surface,
      useEditorStore.getState().parameters.map((p) => p.id)
    );
    if (!identity) {
      throw new Error("expected scalar identity");
    }
    store.setScalarVizConfig(surfaceId, { showHeatmap: true }, identity);
    const scalarConfig = useGraphStore.getState().ui.scalarVizBySourceId[surfaceId];
    const streamIdentity = vectorCalculusSourceIdentity(
      liveObject(fieldId),
      useEditorStore.getState().parameters.map((p) => p.id)
    );
    if (!streamIdentity) {
      throw new Error("expected streamline identity");
    }
    const fieldObject = liveObject(fieldId);
    if (fieldObject.kind !== "vectorField") {
      throw new Error("expected vector field");
    }
    store.setStreamlineConfig(fieldId, { dimension: fieldObject.dimension, enabled: true }, streamIdentity);
    const streamConfig = useGraphStore.getState().ui.streamlineVizBySourceId[fieldId];
    store.setIntegralConfig(surfaceId, { mode: "surfaceArea" });

    const scalarContext = createScalarSyncTestContext();
    const streamContext = createStreamlineSyncTestContext();
    const integralContext = createIntegralSyncTestContext();

    const scalarJob = buildScalarFieldJob(liveObject(surfaceId), scalarConfig, params);
    const streamJob = buildStreamlineJob(liveObject(fieldId), streamConfig, params);
    const integralJob = buildIntegralJob(
      useGraphStore.getState().scene.objects,
      useGraphStore.getState().ui.integralAnalysisBySourceId[surfaceId],
      params
    );

    // First pump (tab opened): one request per pipeline.
    pumpScalarVizJobs(scalarContext, [scalarJob], params, new Set([`scalar:${surfaceId}`]));
    pumpStreamlineJobs(streamContext, [streamJob], params, new Set([`streamline:${fieldId}`]));
    if (integralJob) {
      pumpIntegralJobs(integralContext, [integralJob], params, new Set([`integral:${surfaceId}`]));
    }
    expect(scalarContext.requests).toHaveLength(1);
    expect(streamContext.requests).toHaveLength(1);

    // Navigation storm (tab switches, palette/menu opens, collapse toggles):
    // identical inputs must enqueue zero new jobs.
    pumpScalarVizJobs(scalarContext, [scalarJob], params, new Set([`scalar:${surfaceId}`]));
    pumpStreamlineJobs(streamContext, [streamJob], params, new Set([`streamline:${fieldId}`]));
    if (integralJob) {
      pumpIntegralJobs(integralContext, [integralJob], params, new Set([`integral:${surfaceId}`]));
    }
    expect(scalarContext.requests).toHaveLength(1);
    expect(streamContext.requests).toHaveLength(1);
    if (integralJob) {
      expect(integralContext.requests).toHaveLength(1);
    }
  });
});

describe("S30 persistence: UI reorganization leaks nothing into scenes (Part 39)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("serializes canonical math only with analysis configs active", () => {
    const store = useGraphStore.getState();
    const surfaceId = store.addSurfaceObject();
    store.updateSurfaceEquation(surfaceId, "z = x^2 + y^2");
    const surface = liveObject(surfaceId);
    const identity = scalarVizMathIdentity(
      surface,
      useEditorStore.getState().parameters.map((p) => p.id)
    );
    if (identity) {
      store.setScalarVizConfig(surfaceId, { showHeatmap: true }, identity);
    }
    store.setIntegralConfig(surfaceId, { mode: "surfaceArea" });
    const fieldId = store.addVectorFieldObject("2d");
    const streamIdentity = vectorCalculusSourceIdentity(
      liveObject(fieldId),
      useEditorStore.getState().parameters.map((p) => p.id)
    );
    if (streamIdentity) {
      store.setStreamlineConfig(fieldId, { dimension: "2d", enabled: true }, streamIdentity);
    }
    store.setWorkspace("geometry");
    store.selectObject(surfaceId);

    const scene = createSceneDocument({
      metadata: { name: "s30-ui" },
      objects: useGraphStore.getState().scene.objects,
      measurements: []
    });
    const first = serializeScene(scene);
    expect(first).not.toContain("scalarVizBySourceId");
    expect(first).not.toContain("streamlineVizBySourceId");
    expect(first).not.toContain("integralAnalysis");
    expect(first).not.toContain("workspace");
    expect(first).not.toContain("selectedObjectId");
    expect(first).not.toContain("differentialAnalysis");
    expect(first).not.toContain("vectorCalculus");
    // Roundtrip preserves canonical data (key order is an unstable
    // serialization detail by design; compare parsed documents).
    const revived = validateSceneDocument(JSON.parse(first));
    expect(revived.valid).toBe(true);
    if (revived.normalizedScene) {
      expect(JSON.parse(serializeScene(revived.normalizedScene))).toEqual(JSON.parse(first));
    }
  });
});

describe("S30 selection stability across workspace switches (Part 42)", () => {
  beforeEach(() => {
    resetAll();
    useGraphStore.getState().setWorkspace("math");
  });

  it("preserves selection through repeated workspace switches", () => {
    const store = useGraphStore.getState();
    const id = store.addSurfaceObject();
    store.selectObject(id);
    store.setWorkspace("geometry");
    store.setWorkspace("math");
    store.setWorkspace("geometry");
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
    expect(useGraphStore.getState().scene.objects.length).toBe(1);
  });
});

describe("S30 Quick Add trim: definition drafts survive tab context (Part 43)", () => {
  beforeEach(() => {
    resetAll();
  });

  it("matrix drafts live in the Object tab independent of Analyze", () => {
    const store = useGraphStore.getState();
    const id = store.addLinearTransformObject("2d");
    store.selectObject(id);
    const { container } = render(<AnalysisInspector />);
    // Analyze shows properties/eigen/apply, never the matrix grid editor.
    expect(screen.getByTestId("linear-fact-determinant")).toBeInTheDocument();
    expect(container.querySelector("input[aria-label='Row 1 column 1']")).toBeNull();
  });
});
