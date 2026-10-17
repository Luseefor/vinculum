import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ParametricDimensionControl from "@/components/expressions/ParametricDimensionControl";
import { ParametricCurveDefinitionEditor, ParametricSurfaceDefinitionEditor } from "@/components/inspector/MathDefinitionEditors";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { createSceneDocument, CURRENT_SCENE_SCHEMA_VERSION } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { export2dSvg } from "@/lib/export/sceneExport";

const xy = { horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" } as const;
const region = () => createParametricSurfaceGraph({ dimension: "2d", xExpr: "u * cos(v)", yExpr: "u * sin(v)", zExpr: "u + v", domain: { uMin: 1, uMax: 2, vMin: 0, vMax: 2 * Math.PI }, resolution: 16 });

describe("parametric dimension controls", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useEditorStore.getState().setViewportMode("3d");
  });

  it("switches dimension and view in one click, with pressed state", () => {
    const id = useGraphStore.getState().addParametricCurve();
    function Control() {
      const object = useGraphStore(state => state.scene.objects[0]);
      return object?.kind === "parametricCurve" ? <ParametricDimensionControl object={object} /> : null;
    }
    render(<Control />);
    fireEvent.click(screen.getByRole("button", { name: "2D" }));
    expect(screen.getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    expect(useEditorStore.getState().viewportMode).toBe("2d");
    expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ id, dimension: "2d", zExpr: "0" });
    fireEvent.click(screen.getByRole("button", { name: "3D" }));
    expect(screen.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");
    expect(useEditorStore.getState().viewportMode).toBe("3d");
  });

  it("hides inactive Z fields in planar definition editors", () => {
    const curve = createParametricCurve({ dimension: "2d" });
    const { unmount } = render(<ParametricCurveDefinitionEditor object={curve} index={0} />);
    expect(screen.getByLabelText("Parametric x(t)")).toBeVisible();
    expect(screen.queryByLabelText("Parametric z(t)")).toBeNull();
    unmount();
    render(<ParametricSurfaceDefinitionEditor object={region()} index={0} />);
    expect(screen.getByLabelText("Parametric surface x(u,v)")).toBeVisible();
    expect(screen.queryByLabelText("Parametric surface z(u,v)")).toBeNull();
  });
});

describe("planar parametric persistence and rendering", () => {
  it("round-trips dimension and inactive Z through canonical JSON", () => {
    const objects = [region(), createParametricCurve({ dimension: "2d", zExpr: "t^2" })];
    const result = deserializeScene(serializeScene(createSceneDocument({ objects })));
    expect(result.errors).toEqual([]);
    expect(result.normalizedScene?.objects).toEqual(objects);
    expect(result.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
  });

  it("migrates v3 without reinterpreting a flat spatial object as 2D", () => {
    const object = createParametricSurfaceGraph({ zExpr: "0" });
    const result = deserializeScene(JSON.stringify({ ...createSceneDocument({ objects: [object] }), schemaVersion: 3 }));
    expect(result.valid).toBe(true);
    expect(result.normalizedScene?.objects[0]).toEqual(object);
    expect(buildRenderableGraphsFromScene(result.normalizedScene!.objects, xy, {})[0].meshXY?.indices.length).toBeGreaterThan(0);
  });

  it.each([{ dimension: "4d" }, { zExpr: "u" }, { spatialZExpr: "import('bad')" }, { spatialZExpr: 42 }])("rejects invalid planar metadata %j", patch => {
    const document = createSceneDocument({ objects: [region()] });
    const result = deserializeScene(JSON.stringify({ ...document, objects: [{ ...document.objects[0], ...patch }] }));
    expect(result.valid).toBe(false);
    expect(result.normalizedScene).toBeUndefined();
  });

  it("renders the sampled annulus in XY, preserving the inner hole", () => {
    const object = region();
    const [graph] = buildRenderableGraphsFromScene([object], xy, {});
    const mesh = graph.meshXY!;
    expect(mesh.indices.length).toBe(16 * 16 * 6);
    for (let i = 0; i < mesh.points.length; i += 2) {
      expect(Math.hypot(mesh.points[i], mesh.points[i + 1])).toBeGreaterThan(0.99);
    }
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const indices = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
      const centerX = indices.reduce((sum, index) => sum + mesh.points[index * 2], 0) / 3;
      const centerY = indices.reduce((sum, index) => sum + mesh.points[index * 2 + 1], 0) / 3;
      expect(Math.hypot(centerX, centerY)).toBeGreaterThan(0.9);
    }
    expect(buildRenderableGraphsFromScene([{ ...object, visible: false }], xy, {})).toEqual([]);
    expect(buildRenderableGraphsFromScene([object], { horizontal: "x", vertical: "z", horizontalLabel: "X", verticalLabel: "Z" }, {})).toEqual([]);
  });

  it("isolates invalid maps and exports real planar triangles to SVG", async () => {
    const object = region();
    expect(buildRenderableGraphsFromScene([{ ...object, xExpr: "unknown(u)" }], xy, {})).toEqual([]);
    const result = export2dSvg({ sceneName: "Planar region", objects: [object], axisPair: "xy", viewport: { centerX: 0, centerY: 0, scale: 40 }, viewportFrame: { width: 600, height: 400 } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(await result.file!.blob.text()).toContain('fill-opacity="0.25"');
      expect(result.file!.warnings).toEqual([]);
    }
  });
});
