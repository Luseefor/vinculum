import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getObjectRowDisplayMeta } from "@/components/objects/objectRowUtils";
import GeometryAnalysisSection, { geometryOverlayToggleLabel } from "@/components/inspector/GeometryAnalysisSection";
import ObjectInspector from "@/components/inspector/ObjectInspector";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { validateSceneDocument } from "@/lib/scene/validateScene";
import type { GeometryAnalysisFacts } from "@/lib/math/geometryAnalysis";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { createPointGraph } from "@/lib/graph/createPointGraph";
import { createVectorGraph, createLineGraph, createRayGraph, createSegmentGraph } from "@/lib/graph/createGeometryPrimitiveGraphs";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";

const POINT = { x: 0, y: 0, z: 0 };

describe("S31 row snippets answer what the object is mathematically (Part 5)", () => {
  it("prefixes point, vector, line, ray, and segment snippets", () => {
    expect(getObjectRowDisplayMeta(createPointGraph({})).type).toMatch(/^P=\(/);
    expect(getObjectRowDisplayMeta(createVectorGraph({})).type).toMatch(/^v=</);
    expect(getObjectRowDisplayMeta(createLineGraph({})).type).toMatch(/^L:/);
    const ray = getObjectRowDisplayMeta(createRayGraph({})).type;
    expect(ray).toMatch(/^R:/);
    expect(ray).toContain("t≥0");
    expect(getObjectRowDisplayMeta(createSegmentGraph({})).type).toMatch(/^S:.*→/);
  });

  it("shows the plane equation instead of a bare kind label", () => {
    const meta = getObjectRowDisplayMeta(createPlaneGraph({ equation: "x + 2*y - z = 3" }));
    expect(meta.label).toBe("Plane");
    expect(meta.type).toContain("x+2*y-z=3");
  });
});

describe("S31 overlay toggle labels name the construction (Part 12)", () => {
  it("labels projection, intersection, overlap, and closest connection distinctly", () => {
    expect(
      geometryOverlayToggleLabel({ pair: "point-plane", projection: { projection: POINT, distance: 1, signedDistance: 1 } })
    ).toBe("Show projection");
    expect(
      geometryOverlayToggleLabel({
        pair: "linear-linear",
        relation: { kind: "intersect", point: POINT, parameterA: 0, parameterB: 0, distance: 0 },
        angleRadians: 0
      })
    ).toBe("Show intersection");
    expect(
      geometryOverlayToggleLabel({
        pair: "linear-linear",
        relation: { kind: "overlap", start: null, end: null, direction: null, bounded: "segment" },
        angleRadians: 0
      })
    ).toBe("Show overlap");
    expect(
      geometryOverlayToggleLabel({
        pair: "linear-linear",
        relation: { kind: "skew", pointA: POINT, pointB: POINT, parameterA: 0, parameterB: 0, distance: 1 },
        angleRadians: 0
      } as GeometryAnalysisFacts)
    ).toBe("Show closest connection");
    expect(
      geometryOverlayToggleLabel({
        pair: "plane-plane",
        intersection: { kind: "line", point: POINT, direction: { x: 1, y: 0, z: 0 } },
        angleRadians: 0,
        distance: 0
      })
    ).toBe("Show intersection line");
  });

  it("offers no toggle where no construction exists", () => {
    expect(
      geometryOverlayToggleLabel({ pair: "linear-linear", relation: { kind: "coincident" }, angleRadians: 0 })
    ).toBeNull();
    expect(
      geometryOverlayToggleLabel({
        pair: "linear-plane",
        intersection: { kind: "parallel", distance: 2 },
        angleRadians: 0,
        distance: 2
      })
    ).toBeNull();
  });
});

describe("S31 analysis From/With context (Part 10)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("names the primary source and the chosen comparison", () => {
    const pointId = useGraphStore.getState().addPointObject();
    const lineId = useGraphStore.getState().addLineObject();
    useGraphStore.getState().selectObject(pointId);
    useGraphStore.getState().setGeometryAnalysis(pointId, { secondaryId: lineId });
    const point = useGraphStore.getState().scene.objects.find((o) => o.id === pointId)!;
    render(<GeometryAnalysisSection object={point} />);
    expect(screen.getByText(/From Point #1 · With Infinite Line #2/)).toBeInTheDocument();
  });

  it("shows an em dash with no secondary chosen", () => {
    const pointId = useGraphStore.getState().addPointObject();
    useGraphStore.getState().selectObject(pointId);
    const point = useGraphStore.getState().scene.objects.find((o) => o.id === pointId)!;
    render(<GeometryAnalysisSection object={point} />);
    expect(screen.getByText(/From Point #1 · With —/)).toBeInTheDocument();
  });
});

describe("S31 Plane equation editing in the Object tab (Part 16)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("edits the equation in place with draft discipline", () => {
    const store = useGraphStore.getState();
    const id = store.addPlaneObject();
    store.selectObject(id);
    render(<ObjectInspector />);
    const input = screen.getByLabelText("Plane equation") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "z = 2" } });
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({
      kind: "plane",
      equation: "z = 2"
    });
    fireEvent.blur(input);
    expect(useGraphStore.getState().scene.objects.find((o) => o.id === id)).toMatchObject({ equation: "z = 2" });
  });
});

describe("S31 persistence invariance under Geometry UI storms (Part 41)", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("selection, views, analysis UI, and overlays leave the scene identical", () => {
    const pointId = useGraphStore.getState().addPointObject();
    const lineId = useGraphStore.getState().addLineObject();
    const stamp = { name: "s31", createdAt: "2026-09-27T00:00:00.000Z", updatedAt: "2026-09-27T00:00:00.000Z" };
    const before = serializeScene(
      createSceneDocument({
        metadata: stamp,
        objects: useGraphStore.getState().scene.objects,
        measurements: []
      })
    );
    useGraphStore.getState().selectObject(lineId);
    useGraphStore.getState().setWorkspace("geometry");
    useGraphStore.getState().setGeometryAnalysis(pointId, { secondaryId: lineId });
    useGraphStore.getState().setGeometryAnalysis(pointId, { secondaryId: lineId, showOverlay: true });
    useEditorStore.getState().setGeometryView("xy");
    useEditorStore.getState().setGeometryLayout("quad");
    // Note: visibility is canonical scene state (not UI-only), so it stays
    // out of this storm; S27 suites cover its persistence.
    useGraphStore.getState().selectObject(pointId);
    useGraphStore.getState().deselectObject();
    const after = serializeScene(
      createSceneDocument({
        metadata: stamp,
        objects: useGraphStore.getState().scene.objects,
        measurements: []
      })
    );
    expect(JSON.parse(after)).toEqual(JSON.parse(before));
    expect(after).not.toContain("geometryAnalysis");
    expect(validateSceneDocument(JSON.parse(after)).valid).toBe(true);
    expect(validateSceneDocument(JSON.parse(after)).valid).toBe(true);
  });
});
